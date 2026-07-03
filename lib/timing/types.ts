/**
 * WilliamsPod — adaptive timing.
 *
 * Per-question time budgets that vary by question type, difficulty, the run's
 * timing mode, and the runner's recent performance / errors / confidence /
 * concept depth. Pure and self-contained; the hard overall attempt timer is
 * unchanged — this produces an *advisory* per-question budget.
 */

export const TIMING_MODES = [
  "sprint",
  "standard",
  "mechanism",
  "clinical",
  "trap",
  "pressure",
  "recovery",
  "final_lap",
] as const;
export type TimingMode = (typeof TIMING_MODES)[number];

/** 1 = easy, 2 = medium, 3 = hard. */
export type QuestionDifficulty = 1 | 2 | 3;

/** Mirrors the variation angles — a question's cognitive type. */
export const QUESTION_TYPES = [
  "recall",
  "mechanism",
  "clinical_vignette",
  "physical_exam",
  "diagnosis",
  "management",
  "trap",
  "integration",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Concept depth the item is being studied at (aligns with WilliamsHub modes). */
export type ConceptDepth =
  | "quick_review"
  | "standard"
  | "mechanism"
  | "clinical"
  | "trap"
  | "teaching"
  | "onepager";

/** Signals about the runner used to nudge the budget. */
export interface TimingProfile {
  /** 0–1 recent accuracy on this type/subject (lower → more time). */
  recentAccuracy?: number;
  /** Count of recent errors on this question type (more → more time). */
  priorErrorsOnType?: number;
  /** Self-rated confidence 1 (low) – 5 (high), if captured. */
  confidence?: number;
  /** The depth the concept is being trained at. */
  depth?: ConceptDepth;
}

export interface TimingInput {
  questionType: QuestionType;
  difficulty?: QuestionDifficulty;
  mode?: TimingMode;
  profile?: TimingProfile;
}

export interface TimingResult {
  mode: TimingMode;
  questionType: QuestionType;
  difficulty: QuestionDifficulty;
  /** The type's baseline (seconds), midpoint of its range. */
  baseSeconds: number;
  /** After difficulty + mode + profile adjustments. */
  recommendedSeconds: number;
  recommendedMs: number;
  /** Lower/upper advisory band (seconds). */
  minSeconds: number;
  maxSeconds: number;
  /** Human-readable multipliers that produced the result. */
  factors: { difficulty: number; mode: number; profile: number };
}
