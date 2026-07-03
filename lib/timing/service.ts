import {
  type QuestionDifficulty,
  type QuestionType,
  type TimingInput,
  type TimingMode,
  type TimingProfile,
  type TimingResult,
} from "./types";

/**
 * Default per-type budget ranges (seconds). Midpoint is the baseline; the
 * band is surfaced as advisory min/max. Values follow the spec.
 */
export const DEFAULT_TIMING: Record<
  QuestionType,
  { min: number; max: number }
> = {
  recall: { min: 20, max: 30 },
  physical_exam: { min: 30, max: 45 },
  trap: { min: 45, max: 70 },
  mechanism: { min: 60, max: 90 },
  diagnosis: { min: 75, max: 105 },
  management: { min: 75, max: 105 },
  clinical_vignette: { min: 90, max: 120 },
  integration: { min: 120, max: 180 },
};

/** Mode scales the whole budget — pressure/sprint compress, recovery expands. */
const MODE_FACTOR: Record<TimingMode, number> = {
  sprint: 0.6,
  standard: 1.0,
  mechanism: 1.1,
  clinical: 1.1,
  trap: 0.9,
  pressure: 0.7,
  recovery: 1.3,
  final_lap: 0.8,
};

const DIFFICULTY_FACTOR: Record<QuestionDifficulty, number> = {
  1: 0.85,
  2: 1.0,
  3: 1.2,
};

/** Deeper concept work earns a little more time. */
const DEPTH_FACTOR: Record<NonNullable<TimingProfile["depth"]>, number> = {
  quick_review: 0.75,
  standard: 1.0,
  mechanism: 1.15,
  clinical: 1.1,
  trap: 0.95,
  teaching: 1.2,
  onepager: 0.85,
};

function profileFactor(p: TimingProfile | undefined): number {
  if (!p) return 1;
  let f = 1;
  // Weaker recent accuracy → more time (up to +30%).
  if (typeof p.recentAccuracy === "number") {
    const acc = Math.max(0, Math.min(1, p.recentAccuracy));
    f *= 1 + (1 - acc) * 0.3;
  }
  // Prior errors on this type → more time (+8% each, capped +32%).
  if (p.priorErrorsOnType && p.priorErrorsOnType > 0) {
    f *= 1 + Math.min(p.priorErrorsOnType, 4) * 0.08;
  }
  // Low confidence → more time; high confidence → slightly less.
  if (typeof p.confidence === "number") {
    // 1..5 → +20%..-10%
    const c = Math.max(1, Math.min(5, p.confidence));
    f *= 1 + (3 - c) * 0.075;
  }
  if (p.depth) f *= DEPTH_FACTOR[p.depth];
  return f;
}

export function computeTiming(input: TimingInput): TimingResult {
  const mode: TimingMode = input.mode ?? "standard";
  const difficulty: QuestionDifficulty = input.difficulty ?? 2;
  const range = DEFAULT_TIMING[input.questionType];
  const baseSeconds = (range.min + range.max) / 2;

  const dFactor = DIFFICULTY_FACTOR[difficulty];
  const mFactor = MODE_FACTOR[mode];
  const pFactor = profileFactor(input.profile);

  const recommendedSeconds = Math.round(baseSeconds * dFactor * mFactor * pFactor);
  // Advisory band scales with the same factors, clamped to sensible bounds.
  const scale = dFactor * mFactor * pFactor;
  const minSeconds = Math.max(8, Math.round(range.min * scale));
  const maxSeconds = Math.max(minSeconds + 5, Math.round(range.max * scale));

  return {
    mode,
    questionType: input.questionType,
    difficulty,
    baseSeconds,
    recommendedSeconds: Math.max(minSeconds, Math.min(maxSeconds, recommendedSeconds)),
    recommendedMs:
      Math.max(minSeconds, Math.min(maxSeconds, recommendedSeconds)) * 1000,
    minSeconds,
    maxSeconds,
    factors: { difficulty: dFactor, mode: mFactor, profile: pFactor },
  };
}

/**
 * Map a base question's difficulty to a default cognitive type when the item
 * itself has no explicit angle (variants carry their angle directly).
 */
export function inferQuestionType(
  difficulty: number | null,
  angle?: QuestionType | null,
): QuestionType {
  if (angle) return angle;
  if (difficulty === 1) return "recall";
  if (difficulty === 3) return "integration";
  return "clinical_vignette";
}
