import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { questionTelemetry } from "@/lib/db/schema";
import { uid } from "@/lib/utils";
import type { QuestionType } from "@/lib/timing/types";
import type {
  ErrorType,
  TelemetryRecord,
  TimingCategory,
  TrapType,
} from "./types";

export interface TelemetryInsert {
  attemptId: string;
  userId: string | null;
  questionId: string;
  originalQuestionId: string | null;
  variantId: string | null;
  lectureId: string | null;
  subject: string | null;
  questionType: QuestionType;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  timeTakenMs: number;
  clickCount: number;
  answerChangeCount: number;
  revisitCount: number;
  confidence: number | null;
  timingCategory: TimingCategory | null;
  errorType: ErrorType | null;
  trapType: TrapType | null;
}

/** Persist a batch of telemetry rows for one attempt (idempotent per attempt). */
export async function saveTelemetry(rows: TelemetryInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const attemptId = rows[0].attemptId;
  // Re-submits shouldn't double-record.
  await db
    .delete(questionTelemetry)
    .where(eq(questionTelemetry.attemptId, attemptId));
  const now = new Date();
  await db.insert(questionTelemetry).values(
    rows.map((r, i) => ({
      id: uid("tel"),
      ...r,
      trapType: r.trapType,
      attemptedAt: new Date(now.getTime() + i),
    })),
  );
}

function toRecord(row: typeof questionTelemetry.$inferSelect): TelemetryRecord {
  return {
    id: row.id,
    attemptId: row.attemptId,
    userId: row.userId,
    questionId: row.questionId,
    originalQuestionId: row.originalQuestionId,
    variantId: row.variantId,
    lectureId: row.lectureId,
    subject: row.subject,
    questionType: row.questionType as QuestionType,
    selectedIndex: row.selectedIndex,
    correctIndex: row.correctIndex,
    isCorrect: row.isCorrect,
    timeTakenMs: row.timeTakenMs,
    clickCount: row.clickCount,
    answerChangeCount: row.answerChangeCount,
    revisitCount: row.revisitCount,
    confidence: (row.confidence as TelemetryRecord["confidence"]) ?? null,
    timingCategory: row.timingCategory,
    errorType: row.errorType,
    trapType: (row.trapType as TrapType | null) ?? null,
    attemptedAt: new Date(row.attemptedAt).toISOString(),
  };
}

export async function listTelemetryForAttempt(
  attemptId: string,
): Promise<TelemetryRecord[]> {
  const rows = await db
    .select()
    .from(questionTelemetry)
    .where(eq(questionTelemetry.attemptId, attemptId))
    .orderBy(questionTelemetry.attemptedAt);
  return rows.map(toRecord);
}

/** All telemetry for a user (used to build sync packets / repair queues). */
export async function listTelemetryForUser(
  userId: string,
): Promise<TelemetryRecord[]> {
  const rows = await db
    .select()
    .from(questionTelemetry)
    .where(eq(questionTelemetry.userId, userId))
    .orderBy(questionTelemetry.attemptedAt);
  return rows.map(toRecord);
}

export interface TelemetrySummary {
  total: number;
  byTimingCategory: Record<TimingCategory, number>;
  byErrorType: Partial<Record<ErrorType, number>>;
  medianTimeMs: number;
}

/** Aggregate a set of records into a compact summary (for debrief + packets). */
export function summarize(records: TelemetryRecord[]): TelemetrySummary {
  const byTimingCategory = {
    fast_correct: 0,
    slow_correct: 0,
    fast_wrong: 0,
    slow_wrong: 0,
  } as Record<TimingCategory, number>;
  const byErrorType: Partial<Record<ErrorType, number>> = {};
  const times: number[] = [];
  for (const r of records) {
    if (r.timingCategory) byTimingCategory[r.timingCategory]++;
    if (r.errorType) byErrorType[r.errorType] = (byErrorType[r.errorType] ?? 0) + 1;
    times.push(r.timeTakenMs);
  }
  times.sort((a, b) => a - b);
  const medianTimeMs = times.length
    ? times[Math.floor(times.length / 2)]
    : 0;
  return { total: records.length, byTimingCategory, byErrorType, medianTimeMs };
}

/** Recent error counts per question type for a user (feeds adaptive timing). */
export async function recentErrorCountsByType(
  userId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({ type: questionTelemetry.questionType })
    .from(questionTelemetry)
    .where(
      and(eq(questionTelemetry.userId, userId), eq(questionTelemetry.isCorrect, false)),
    );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.type] = (out[r.type] ?? 0) + 1;
  return out;
}
