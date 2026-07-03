import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { questionVariants, questions } from "@/lib/db/schema";
import { uid } from "@/lib/utils";
import type {
  BaseQuestion,
  QuestionVariant,
} from "./types";
import type { GenerateResult } from "./service";

/** Load a bank question as a BaseQuestion (or null if missing/archived). */
export async function loadBaseQuestion(
  questionId: string,
): Promise<BaseQuestion | null> {
  const [row] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, questionId), isNull(questions.archivedAt)));
  if (!row) return null;
  return {
    id: row.id,
    lectureId: row.lectureId,
    stem: row.stem,
    choices: row.choices,
    correctIndex: row.correctIndex,
    explanation: row.explanation,
    topic: row.topic,
    difficulty: row.difficulty,
  };
}

function toVariant(row: typeof questionVariants.$inferSelect): QuestionVariant {
  return {
    id: row.id,
    baseQuestionId: row.baseQuestionId,
    angle: row.angle,
    difficulty: row.difficulty,
    stem: row.stem,
    choices: row.choices,
    correctIndex: row.correctIndex,
    explanation: row.explanation,
    learningObjective: row.learningObjective,
    conceptTag: row.conceptTag,
    provider: row.provider,
    model: row.model,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/** All non-archived variants for a base question, newest first. */
export async function listVariants(
  baseQuestionId: string,
): Promise<QuestionVariant[]> {
  const rows = await db
    .select()
    .from(questionVariants)
    .where(
      and(
        eq(questionVariants.baseQuestionId, baseQuestionId),
        isNull(questionVariants.archivedAt),
      ),
    )
    .orderBy(desc(questionVariants.createdAt));
  return rows.map(toVariant);
}

/** Persist a validated generation result; returns the stored variants. */
export async function saveVariants(
  baseQuestionId: string,
  result: GenerateResult,
  createdById: string | null,
): Promise<QuestionVariant[]> {
  const now = new Date();
  const rows = result.data.variants.map((v, i) => ({
    id: uid("var"),
    baseQuestionId,
    angle: v.angle,
    difficulty: v.difficulty,
    stem: v.stem,
    choices: v.choices,
    correctIndex: v.correctIndex,
    explanation: v.explanation ?? null,
    learningObjective: result.data.learningObjective,
    conceptTag: v.conceptTag ?? null,
    provider: result.provider,
    model: result.model,
    createdById,
    // Stagger createdAt by index so list order matches generation order.
    createdAt: new Date(now.getTime() + i),
  }));
  await db.insert(questionVariants).values(rows);
  return rows.map((r) => toVariant({ ...r, archivedAt: null }));
}

/** Soft-delete a single variant. Returns false if it did not exist. */
export async function archiveVariant(variantId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: questionVariants.id })
    .from(questionVariants)
    .where(eq(questionVariants.id, variantId));
  if (!row) return false;
  await db
    .update(questionVariants)
    .set({ archivedAt: new Date() })
    .where(eq(questionVariants.id, variantId));
  return true;
}
