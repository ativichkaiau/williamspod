import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lectures, questions } from "@/lib/db/schema";
import { parseWorkbook, slugify } from "@/lib/excel";
import { uid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  const mode = (form.get("mode") as string | null) ?? "merge"; // "merge" | "replace"
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
      await db
        .update(lectures)
        .set({ name: pl.name, updatedAt: now })
        .where(eq(lectures.id, lectureId));
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
