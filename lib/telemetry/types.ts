import type { QuestionType } from "@/lib/timing/types";

/**
 * WilliamsPod — per-question telemetry.
 *
 * One record per question attempted in a run: how the runner interacted
 * (clicks, answer changes, revisits, time) plus a derived timing category and
 * error classification. These records are the "telemetry packets" WilliamsSync
 * will later forward to WilliamsHub.
 */

export const TIMING_CATEGORIES = [
  "fast_correct",
  "slow_correct",
  "fast_wrong",
  "slow_wrong",
] as const;
export type TimingCategory = (typeof TIMING_CATEGORIES)[number];

export const ERROR_TYPES = [
  "recall_error",
  "mechanism_error",
  "frame_error",
  "trap_error",
  "overthinking_error",
  "timing_error",
  "confidence_error",
  "integration_error",
] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];

/** Coarse trap taxonomy (extend as needed). */
export const TRAP_TYPES = [
  "specificity_trap", // chose a common-but-nonspecific finding
  "distractor_trap", // chose a plausible near-miss
  "anchoring_trap", // fixated on an early clue
  "none",
] as const;
export type TrapType = (typeof TRAP_TYPES)[number];

/** Self-rated confidence, if captured. 1 = guess, 5 = certain. */
export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

/** The raw interaction metrics collected by the runtime per question. */
export interface QuestionMetrics {
  timeTakenMs: number;
  clickCount: number;
  answerChangeCount: number;
  revisitCount: number;
  confidence?: ConfidenceLevel | null;
}

/** A fully-classified telemetry record (mirrors the DB row). */
export interface TelemetryRecord {
  id: string;
  attemptId: string;
  userId: string | null;
  questionId: string;
  originalQuestionId: string | null; // set when the served item was a variant
  variantId: string | null;
  lectureId: string | null;
  subject: string | null;
  questionType: QuestionType;
  selectedIndex: number; // source index chosen, -1 = unanswered
  correctIndex: number;
  isCorrect: boolean;
  timeTakenMs: number;
  clickCount: number;
  answerChangeCount: number;
  revisitCount: number;
  confidence: ConfidenceLevel | null;
  timingCategory: TimingCategory | null;
  errorType: ErrorType | null;
  trapType: TrapType | null;
  attemptedAt: string; // ISO
}
