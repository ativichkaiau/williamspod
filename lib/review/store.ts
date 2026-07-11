import { and, asc, desc, eq, gt, lte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviewSchedule, type ReviewScheduleRow } from "@/lib/db/schema";
import { uid } from "@/lib/utils";
import type { TimingCategory } from "@/lib/telemetry/types";
import { gradeQuality, nextSchedule } from "./scheduler";

/** One answered question feeding the schedule. */
export interface ReviewItem {
  questionId: string;
  subject: string | null;
  lectureId: string | null;
  answered: boolean;
  isCorrect: boolean;
  confidence: number | null;
  timingCategory: TimingCategory | null;
}

/**
 * Fold one submitted test into the user's review schedule. Loads each
 * question's prior state, grades it, and writes the next due date. Best-effort
 * — callers wrap it so a scheduling hiccup never breaks a submit.
 */
export async function applyReviews(
  userId: string,
  items: ReviewItem[],
  now: Date,
): Promise<void> {
  if (items.length === 0) return;

  const questionIds = Array.from(new Set(items.map((i) => i.questionId)));
  const existing = await db
    .select()
    .from(reviewSchedule)
    .where(
      and(
        eq(reviewSchedule.userId, userId),
        inArray(reviewSchedule.questionId, questionIds),
      ),
    );
  const byQuestion = new Map(existing.map((r) => [r.questionId, r] as const));

  // A question appears once per test; last write wins if not.
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.questionId)) continue;
    seen.add(item.questionId);

    const prev = byQuestion.get(item.questionId) ?? null;
    const quality = gradeQuality(item);
    const next = nextSchedule(
      prev
        ? { reps: prev.reps, ease: prev.ease, intervalDays: prev.intervalDays }
        : null,
      quality,
      now,
    );

    if (prev) {
      await db
        .update(reviewSchedule)
        .set({
          reps: next.reps,
          ease: next.ease,
          intervalDays: next.intervalDays,
          lapses: prev.lapses + next.lapsed,
          lastCorrect: item.isCorrect,
          dueAt: next.dueAt,
          lastReviewedAt: now,
        })
        .where(eq(reviewSchedule.id, prev.id));
    } else {
      await db.insert(reviewSchedule).values({
        id: uid("rev"),
        userId,
        questionId: item.questionId,
        subject: item.subject,
        lectureId: item.lectureId,
        reps: next.reps,
        ease: next.ease,
        intervalDays: next.intervalDays,
        lapses: next.lapsed,
        lastCorrect: item.isCorrect,
        dueAt: next.dueAt,
        lastReviewedAt: now,
      });
    }
  }
}

/** How many scheduled questions are due for review right now. */
export async function countDue(userId: string, now = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(reviewSchedule)
    .where(
      and(
        eq(reviewSchedule.userId, userId),
        lte(reviewSchedule.dueAt, now),
      ),
    );
  return Number(row?.n ?? 0);
}

/** Due questions, most-overdue first. */
export async function listDueQuestionIds(
  userId: string,
  limit: number,
  now = new Date(),
): Promise<string[]> {
  const rows = await db
    .select({ questionId: reviewSchedule.questionId })
    .from(reviewSchedule)
    .where(and(eq(reviewSchedule.userId, userId), lte(reviewSchedule.dueAt, now)))
    .orderBy(asc(reviewSchedule.dueAt))
    .limit(limit);
  return rows.map((r) => r.questionId);
}

/** Not-yet-due questions the user has lapsed on — weak but not overdue. */
export async function listLapsingQuestionIds(
  userId: string,
  limit: number,
  now = new Date(),
): Promise<string[]> {
  const rows = await db
    .select({ questionId: reviewSchedule.questionId })
    .from(reviewSchedule)
    .where(
      and(
        eq(reviewSchedule.userId, userId),
        gt(reviewSchedule.dueAt, now),
        gt(reviewSchedule.lapses, 0),
      ),
    )
    .orderBy(desc(reviewSchedule.lapses))
    .limit(limit);
  return rows.map((r) => r.questionId);
}

/** Question ids the user already has scheduled (to exclude when filling fresh). */
export async function listScheduledQuestionIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ questionId: reviewSchedule.questionId })
    .from(reviewSchedule)
    .where(eq(reviewSchedule.userId, userId));
  return new Set(rows.map((r) => r.questionId));
}

export type { ReviewScheduleRow };
