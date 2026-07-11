import type { TimingCategory } from "@/lib/telemetry/types";

/**
 * Spaced repetition — an SM-2-lite scheduler. Each answered question gets a
 * quality score (0 worst … 5 best) from correctness, speed and confidence, and
 * that drives when it next comes due. Miss it and it resets to tomorrow; nail
 * it and the interval stretches by an ease factor. Pure functions — the store
 * persists what these return.
 */

export const DEFAULT_EASE = 2500; // ×1000 (2.5)
const MIN_EASE = 1300;

export interface QualityInput {
  answered: boolean;
  isCorrect: boolean;
  confidence: number | null;
  timingCategory: TimingCategory | null;
}

/** Map an answered question to an SM-2 quality score, 0–5. */
export function gradeQuality(input: QualityInput): number {
  if (!input.answered) return 0; // left blank — treat as a total miss
  if (!input.isCorrect) {
    // Impulsive misses score lower than worked-through misses.
    return input.timingCategory === "fast_wrong" ? 1 : 2;
  }
  // Correct: fluent = 5, laboured = 3, otherwise 4. A low-confidence right
  // answer (a lucky guess) is capped so it still comes back around soon.
  let q = 4;
  if (input.timingCategory === "fast_correct") q = 5;
  else if (input.timingCategory === "slow_correct") q = 3;
  if (input.confidence != null && input.confidence <= 2) q = Math.min(q, 3);
  return q;
}

export interface ScheduleState {
  reps: number;
  ease: number; // ×1000
  intervalDays: number;
}

export interface ScheduleResult extends ScheduleState {
  dueAt: Date;
  /** 1 when a learned question was missed (a lapse), else 0. */
  lapsed: 0 | 1;
}

const DAY_MS = 86_400_000;

/**
 * Next schedule from the prior state + this review's quality. `prev` is null
 * the first time a question is seen.
 */
export function nextSchedule(
  prev: ScheduleState | null,
  quality: number,
  now: Date,
): ScheduleResult {
  const priorReps = prev?.reps ?? 0;
  const priorEase = prev?.ease ?? DEFAULT_EASE;
  const priorInterval = prev?.intervalDays ?? 0;

  // SM-2 ease update (kept in ×1000 integer units).
  const q = quality;
  const easeDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const ease = Math.max(MIN_EASE, Math.round(priorEase + easeDelta * 1000));

  if (q < 3) {
    // Failed — relearn tomorrow. A lapse only if it had been learned.
    return {
      reps: 0,
      ease,
      intervalDays: 1,
      dueAt: new Date(now.getTime() + DAY_MS),
      lapsed: priorReps > 0 ? 1 : 0,
    };
  }

  const reps = priorReps + 1;
  let intervalDays: number;
  if (reps === 1) intervalDays = 1;
  else if (reps === 2) intervalDays = 6;
  else intervalDays = Math.max(1, Math.round(priorInterval * (ease / 1000)));

  return {
    reps,
    ease,
    intervalDays,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
    lapsed: 0,
  };
}
