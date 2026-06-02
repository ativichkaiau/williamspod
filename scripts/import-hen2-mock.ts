import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  await import("../lib/env");

  const { eq } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { lectures, questions } = await import("../lib/db/schema");
  const { parseWorkbook, slugify } = await import("../lib/excel");
  const { uid } = await import("../lib/utils");

  const filePath = resolve(process.cwd(), process.argv[2] ?? "hen-2-mock.xlsx");
  const mode = process.argv.includes("--merge") ? "merge" : "replace";
  const bytes = readFileSync(filePath);
  const workbookBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const parsed = parseWorkbook(workbookBuffer);

  if (parsed.lectures.length === 0 || parsed.errors.length > 0) {
    console.error(JSON.stringify({ ok: false, errors: parsed.errors }, null, 2));
    process.exit(1);
  }

  const now = new Date();
  let questionOrdinal = 0;
  const inserted: {
    lecture: string;
    count: number;
    mode: "created" | "merged" | "replaced";
  }[] = [];

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
        .set({ name: pl.name, updatedAt: now, archivedAt: null })
        .where(eq(lectures.id, lectureId));
    }

    for (const q of pl.questions) {
      const questionTimestamp = new Date(now.getTime() + questionOrdinal);
      questionOrdinal += 1;
      await db.insert(questions).values({
        id: uid("q"),
        lectureId,
        stem: q.stem,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        topic: q.topic,
        difficulty: q.difficulty,
        createdAt: questionTimestamp,
        updatedAt: questionTimestamp,
      });
    }

    inserted.push({ lecture: pl.name, count: pl.questions.length, mode: actionMode });
  }

  console.log(JSON.stringify({ ok: true, inserted }, null, 2));
}

main().catch((err) => {
  const cause = (err as { cause?: unknown }).cause;
  const code = (cause as { code?: string } | undefined)?.code;
  if (code === "BLOCKED") {
    console.error(
      "Database write blocked: the configured DATABASE_URL does not allow writes. " +
        "Run with DATABASE_URL=file:./williamspod.db to import into the local DB.",
    );
  } else {
    console.error(err);
    if (cause) console.error("cause:", cause);
  }
  process.exit(1);
});
