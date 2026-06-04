import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lectures, questions } from "@/lib/db/schema";
import { parseWorkbook, slugify } from "@/lib/excel";
import { uid } from "@/lib/utils";
import { apiAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  const mode = (form.get("mode") as string | null) ?? "merge"; // "merge" | "replace"
  const subjectRaw = (form.get("subject") as string | null) ?? null;
  const subject = subjectRaw && subjectRaw.trim() !== "" ? subjectRaw.trim().slice(0, 80) : null;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing 'file' field" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large (max 20MB)" }, { status: 413 });
  }
  const buf = await file.arrayBuffer();
  let parsed;
  try {
    parsed = parseWorkbook(buf);
  } catch (err) {
    return NextResponse.json(
      { error: `parse failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (parsed.lectures.length === 0) {
    return NextResponse.json(
      { error: "no valid sheets found", details: parsed.errors },
      { status: 422 },
    );
  }

  const inserted: { lecture: string; count: number; mode: "created" | "merged" | "replaced" }[] = [];
  const now = new Date();

  for (const pl of parsed.lectures) {
    const slug = slugify(pl.name);
    const existing = await db.select().from(lectures).where(eq(lectures.slug, slug));
    let lectureId: string;
    let actionMode: "created" | "merged" | "replaced";

    if (existing.length === 0) {
      lectureId = uid("lec");
      await db.insert(lectures).values({
        id: lectureId,
        name: pl.name,
        slug,
        subject,
        orderIndex: 0,
        createdAt: now,
        updatedAt: now,
      });
      actionMode = "created";
    } else {
      lectureId = existing[0].id;
      if (mode === "replace") {
        await db.delete(questions).where(eq(questions.lectureId, lectureId));
        actionMode = "replaced";
      } else {
        actionMode = "merged";
      }
      // Update subject only when the form explicitly provides one — empty
      // string is treated as "don't change" so re-uploading without a subject
      // doesn't clobber existing groupings.
      const updates: Partial<typeof lectures.$inferInsert> = {
        name: pl.name,
        updatedAt: now,
      };
      if (subject) updates.subject = subject;
      await db.update(lectures).set(updates).where(eq(lectures.id, lectureId));
    }

    for (const q of pl.questions) {
      await db.insert(questions).values({
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
      });
    }
    inserted.push({ lecture: pl.name, count: pl.questions.length, mode: actionMode });
  }

  return NextResponse.json({
    ok: true,
    inserted,
    warnings: parsed.errors,
  });
}
