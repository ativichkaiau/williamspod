import { eq } from "drizzle-orm";

import { db } from "./db";
import { lectures, questions } from "./db/schema";
import { slugify, type ParsedQuestion } from "./excel";
import { uid } from "./utils";

export type ImportMode = "merge" | "replace";
export type ImportActionMode = "created" | "merged" | "replaced";

export interface ImportBankLecture {
  name: string;
  subject?: string | null;
  questions: ParsedQuestion[];
}

export interface ImportBankOptions {
  mode?: ImportMode;
  /**
   * Optional admin-supplied subject override. When omitted, each lecture's own
   * subject is preserved; when null/blank, existing lecture subjects are not
   * clobbered on merge.
   */
  subject?: string | null;
}

export interface ImportBankResult {
  lecture: string;
  lectureId: string;
  slug: string;
  subject: string | null;
  count: number;
  mode: ImportActionMode;
}

function normalizeSubject(subject: string | null | undefined): string | null {
  const value = subject?.trim();
  return value ? value.slice(0, 80) : null;
}

/**
 * Shared DB import path for admin-uploaded XLSX banks and pulled WilliamsHub
 * feeds. It creates/updates lectures by slug, optionally replaces existing
 * questions, then bulk-inserts the new question rows for each lecture.
 */
export async function importLecturesIntoBank(
  payloads: ImportBankLecture[],
  opts: ImportBankOptions = {},
): Promise<ImportBankResult[]> {
  const mode: ImportMode = opts.mode === "replace" ? "replace" : "merge";
  const subjectOverride = normalizeSubject(opts.subject);
  const now = new Date();
  let questionOrdinal = 0;
  const inserted: ImportBankResult[] = [];

  for (const payload of payloads) {
    const slug = slugify(payload.name);
    const subject = subjectOverride ?? normalizeSubject(payload.subject);
    const existing = await db.select().from(lectures).where(eq(lectures.slug, slug));
    let lectureId: string;
    let actionMode: ImportActionMode;

    if (existing.length === 0) {
      lectureId = uid("lec");
      await db.insert(lectures).values({
        id: lectureId,
        name: payload.name,
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

      const updates: Partial<typeof lectures.$inferInsert> = {
        name: payload.name,
        updatedAt: now,
      };
      if (subject) updates.subject = subject;
      await db.update(lectures).set(updates).where(eq(lectures.id, lectureId));
    }

    if (payload.questions.length > 0) {
      await db.insert(questions).values(
        payload.questions.map((q) => {
          const timestamp = new Date(now.getTime() + questionOrdinal);
          questionOrdinal += 1;
          return {
            id: uid("q"),
            lectureId,
            stem: q.stem,
            choices: q.choices,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            topic: q.topic,
            difficulty: q.difficulty,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
        }),
      );
    }

    inserted.push({
      lecture: payload.name,
      lectureId,
      slug,
      subject,
      count: payload.questions.length,
      mode: actionMode,
    });
  }

  return inserted;
}
