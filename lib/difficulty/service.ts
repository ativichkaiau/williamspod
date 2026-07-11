import type { QuestionDifficulty } from "@/lib/timing/types";

/**
 * Real difficulty from telemetry. Authors tag a question 1-3 by hand, but once
 * enough people have answered it, its actual accuracy tells the truth. These
 * helpers blend the hand-set difficulty with the observed accuracy (weighted by
 * how much data exists) so a "2" everyone misses drifts toward a 3 on its own.
 * The blended value feeds adaptive timing and the rating opponents.
 */

export interface AnswerStats {
  attempts: number;
  correct: number;
  sumTimeMs: number;
}

/** Below this many attempts, observed difficulty isn't shown on its own. */
export const MIN_ATTEMPTS = 5;
/** Attempts at which observed accuracy fully outweighs the hand-set value. */
const FULL_WEIGHT_AT = 20;

const DEFAULT_MANUAL = 2;

/** Raw observed difficulty (1 easy … 3 hard) from accuracy alone. */
function rawObserved(stats: AnswerStats): number {
  const acc = stats.attempts > 0 ? stats.correct / stats.attempts : 0.5;
  return clamp(1 + 2 * (1 - acc), 1, 3);
}

/**
 * Observed difficulty for display (one decimal), or null until MIN_ATTEMPTS.
 * This is the "what the data says" number shown next to the author's rating.
 */
export function observedDifficulty(stats: AnswerStats | null): number | null {
  if (!stats || stats.attempts < MIN_ATTEMPTS) return null;
  return Math.round(rawObserved(stats) * 10) / 10;
}

/**
 * The difficulty actually used by timing + ratings: the hand-set value blended
 * toward observed accuracy as data accumulates. Returns a 1|2|3 bucket.
 */
export function effectiveDifficulty(
  manual: number | null | undefined,
  stats: AnswerStats | null,
): QuestionDifficulty {
  const manualD = manual ?? DEFAULT_MANUAL;
  if (!stats || stats.attempts === 0) {
    return clampBucket(manualD);
  }
  const weight = clamp(stats.attempts / FULL_WEIGHT_AT, 0, 1);
  const blended = manualD * (1 - weight) + rawObserved(stats) * weight;
  return clampBucket(Math.round(blended));
}

/** Human label for a difficulty value. */
export function difficultyLabel(d: number): "easy" | "medium" | "hard" {
  if (d < 1.5) return "easy";
  if (d < 2.5) return "medium";
  return "hard";
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function clampBucket(x: number): QuestionDifficulty {
  return clamp(Math.round(x), 1, 3) as QuestionDifficulty;
}
