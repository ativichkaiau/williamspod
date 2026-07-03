import type { QuestionType } from "@/lib/timing/types";
import type {
  ErrorType,
  QuestionMetrics,
  TimingCategory,
  TrapType,
} from "./types";

/**
 * Pure error classifier. Given correctness, timing vs the expected budget, and
 * interaction metrics, derive a timing category + error type + trap type and a
 * set of soft signals. No I/O — trivially testable.
 *
 * Heuristics (from the spec):
 *  - fast wrong  → impulsive / trap risk
 *  - slow wrong  → weak concept (by question type)
 *  - slow correct→ not fluent
 *  - many clicks / revisits / changes → uncertainty / unstable concept
 */

export interface ClassifyInput {
  isCorrect: boolean;
  timeTakenMs: number;
  /** The adaptive budget for this item (ms). */
  expectedMs: number;
  questionType: QuestionType;
  metrics: Pick<
    QuestionMetrics,
    "clickCount" | "answerChangeCount" | "revisitCount" | "confidence"
  >;
  answered: boolean;
}

export interface ClassifyResult {
  timingCategory: TimingCategory | null; // null when unanswered
  errorType: ErrorType | null; // null when correct
  trapType: TrapType;
  signals: string[];
}

const FAST_RATIO = 0.5; // <= 50% of budget = "fast"
const SLOW_RATIO = 1.4; // >= 140% of budget = "slow"

function conceptErrorForType(type: QuestionType): ErrorType {
  switch (type) {
    case "recall":
    case "physical_exam":
      return "recall_error";
    case "mechanism":
      return "mechanism_error";
    case "integration":
      return "integration_error";
    case "trap":
      return "trap_error";
    case "diagnosis":
    case "management":
    case "clinical_vignette":
    default:
      return "frame_error";
  }
}

export function classifyAttempt(input: ClassifyInput): ClassifyResult {
  const { isCorrect, timeTakenMs, expectedMs, questionType, metrics, answered } =
    input;
  const signals: string[] = [];

  if (!answered) {
    return {
      timingCategory: null,
      errorType: timeTakenMs >= expectedMs * SLOW_RATIO ? "timing_error" : null,
      trapType: "none",
      signals: ["unanswered"],
    };
  }

  const ratio = expectedMs > 0 ? timeTakenMs / expectedMs : 1;
  const fast = ratio <= FAST_RATIO;
  const slow = ratio >= SLOW_RATIO;

  const timingCategory: TimingCategory = isCorrect
    ? fast
      ? "fast_correct"
      : "slow_correct"
    : fast
      ? "fast_wrong"
      : "slow_wrong";

  // Interaction signals (uncertainty / instability).
  if (metrics.clickCount >= 4) signals.push("many_clicks");
  if (metrics.answerChangeCount >= 2) signals.push("many_changes");
  if (metrics.revisitCount >= 2) signals.push("many_revisits");
  if (isCorrect && slow) signals.push("not_fluent");
  if (fast) signals.push(isCorrect ? "decisive" : "impulsive");

  let errorType: ErrorType | null = null;
  let trapType: TrapType = "none";

  if (!isCorrect) {
    // High stated confidence but wrong → confidence error dominates.
    if (metrics.confidence != null && metrics.confidence >= 4) {
      errorType = "confidence_error";
    } else if (fast) {
      // Fast wrong → impulsive / trap risk.
      errorType = "trap_error";
      trapType = "distractor_trap";
      signals.push("trap_risk");
    } else if (metrics.answerChangeCount >= 2 && slow) {
      // Second-guessed into a wrong answer.
      errorType = "overthinking_error";
    } else if (slow) {
      // Weak concept — map to the type.
      errorType = conceptErrorForType(questionType);
    } else {
      errorType = conceptErrorForType(questionType);
    }
  }

  return { timingCategory, errorType, trapType, signals };
}
