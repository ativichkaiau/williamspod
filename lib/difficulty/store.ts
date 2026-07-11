import { inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { questionStats } from "@/lib/db/schema";
import type { AnswerStats } from "./service";

/** One answered question's contribution to the aggregate stats. */
export interface StatBump {
  questionId: string;
  isCorrect: boolean;
  timeMs: number;
}

/**
 * Increment aggregate answer stats for a batch of questions (one submit).
 * Upsert per question so it accumulates across users. Best-effort — callers
 * wrap it; a stats hiccup must never break a submit.
 */
export async function bumpQuestionStats(bumps: StatBump[]): Promise<void> {
  if (bumps.length === 0) return;
  // Collapse duplicates within the same submit (a question appears once anyway).
  const now = new Date();
  for (const b of bumps) {
    await db
      .insert(questionStats)
      .values({
        questionId: b.questionId,
        attempts: 1,
        correct: b.isCorrect ? 1 : 0,
        sumTimeMs: Math.max(0, Math.round(b.timeMs)),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: questionStats.questionId,
        set: {
          attempts: sql`${questionStats.attempts} + 1`,
          correct: sql`${questionStats.correct} + ${b.isCorrect ? 1 : 0}`,
          sumTimeMs: sql`${questionStats.sumTimeMs} + ${Math.max(0, Math.round(b.timeMs))}`,
          updatedAt: now,
        },
      });
  }
}

/** Load stats for a set of questions as a map (missing = no data yet). */
export async function loadQuestionStats(
  questionIds: string[],
): Promise<Map<string, AnswerStats>> {
  if (questionIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(questionStats)
    .where(inArray(questionStats.questionId, questionIds));
  return new Map(
    rows.map((r) => [
      r.questionId,
      { attempts: r.attempts, correct: r.correct, sumTimeMs: r.sumTimeMs },
    ]),
  );
}
