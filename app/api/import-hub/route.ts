import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lectures, questions } from "@/lib/db/schema";
import { slugify } from "@/lib/excel";
import { uid } from "@/lib/utils";
import { apiAuth } from "@/lib/auth";
import { mapHubBank, type HubBankFeed, type HubIndexEntry } from "@/lib/hub-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_HUB = process.env.WILLIAMSHUB_ORIGIN ?? "https://williamshub.vercel.app";
const CHUNK = 40; // keep well under SQLite's variable limit per insert

export async function POST(req: Request) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const origin = (typeof body.origin === "string" && body.origin.trim() ? body.origin.trim() : DEFAULT_HUB).replace(/\/+$/, "");
  const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : null;
  const mode = body.mode === "replace" ? "replace" : "merge";

  // Pull the bank (subject-filtered) + the search index (module → source/subject).
  let feed: HubBankFeed;
  let index: HubIndexEntry[];
  try {
    const bankUrl = `${origin}/api/question-bank${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
    const [bankRes, idxRes] = await Promise.all([
      fetch(bankUrl, { cache: "no-store" }),
      fetch(`${origin}/search-index.json`, { cache: "no-store" }),
    ]);
    if (!bankRes.ok) {
      const j = (await bankRes.json().catch(() => ({}))) as { error?: string };
      return NextResponse.json({ error: j.error ?? `WilliamsHub responded ${bankRes.status}` }, { status: 502 });
    }
    feed = (await bankRes.json()) as HubBankFeed;
    index = idxRes.ok ? ((await idxRes.json()) as HubIndexEntry[]) : [];
  } catch (err) {
    return NextResponse.json({ error: `Could not reach WilliamsHub at ${origin}: ${(err as Error).message}` }, { status: 502 });
  }

  const hubLectures = mapHubBank(feed, index, subject);
  if (hubLectures.length === 0) {
    return NextResponse.json({ error: "No importable questions found (check the subject code)." }, { status: 422 });
  }

  const inserted: { lecture: string; count: number; mode: "created" | "merged" | "replaced" }[] = [];
  const now = new Date();

  for (const hl of hubLectures) {
    const slug = slugify(hl.name);
    const existing = await db.select().from(lectures).where(eq(lectures.slug, slug));
    let lectureId: string;
    let action: "created" | "merged" | "replaced";

    if (existing.length === 0) {
      lectureId = uid("lec");
      await db.insert(lectures).values({
        id: lectureId,
        name: hl.name,
        slug,
        subject: hl.subject,
        orderIndex: 0,
        createdAt: now,
        updatedAt: now,
      });
      action = "created";
    } else {
      lectureId = existing[0].id;
      if (mode === "replace") {
        await db.delete(questions).where(eq(questions.lectureId, lectureId));
        action = "replaced";
      } else {
        action = "merged";
      }
      const updates: Partial<typeof lectures.$inferInsert> = { name: hl.name, updatedAt: now };
      if (hl.subject) updates.subject = hl.subject;
      await db.update(lectures).set(updates).where(eq(lectures.id, lectureId));
    }

    const rows = hl.questions.map((q) => ({
      id: uid("q"),
      lectureId,
      stem: q.stem,
      choices: q.choices,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      topic: q.topic,
      difficulty: q.difficulty,
      createdAt: now,
      updatedAt: now,
    }));
    for (let i = 0; i < rows.length; i += CHUNK) {
      await db.insert(questions).values(rows.slice(i, i + CHUNK));
    }
    inserted.push({ lecture: hl.name, count: rows.length, mode: action });
  }

  return NextResponse.json({
    ok: true,
    source: origin,
    subject,
    lectures: inserted.length,
    questions: inserted.reduce((n, x) => n + x.count, 0),
    inserted,
  });
}
