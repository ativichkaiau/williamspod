import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  await import("../lib/env");

  const { eq } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { lectures, questions } = await import("../lib/db/schema");
  const { parseWorkbook, slugify } = await import("../lib/excel");
  const { uid } = await import("../lib/utils");

  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error(
      "usage: npx tsx scripts/import-bank-xlsx.ts <file.xlsx> --subject HMS-2 [--merge]",
    );
    process.exit(1);
  }

  const subjectIndex = process.argv.indexOf("--subject");
  const subject =
    subjectIndex >= 0 ? process.argv[subjectIndex + 1]?.trim().slice(0, 80) : null;
  const mode = process.argv.includes("--merge") ? "merge" : "replace";
  const filePath = resolve(process.cwd(), fileArg);
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
  const imported: {
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
        subject: subject || null,
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
        .set({
          name: pl.name,
          subject: subject || existing[0].subject,
          archivedAt: null,
          updatedAt: now,
        })
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

    imported.push({ lecture: pl.name, count: pl.questions.length, mode: actionMode });
  }

  console.log(JSON.stringify({ ok: true, subject, imported }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
