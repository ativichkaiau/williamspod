import type { ConfidenceLevel, TelemetryRecord } from "./types";

/**
 * Confidence calibration — "where your telemetry lies".
 *
 * The runner self-rates conviction 1-5 per question. This turns that rating
 * plus correctness into a calibration picture: a Brier score, a per-level
 * predicted-vs-actual curve, and the two dangerous quadrants — confidently
 * wrong (overconfident) and needlessly hesitant (underconfident). Pure
 * function over the telemetry records already stored; no new data required.
 */

/** Map a 1-5 conviction rating to a probability of being correct. */
export const CONFIDENCE_TO_P: Record<ConfidenceLevel, number> = {
  1: 0.1,
  2: 0.3,
  3: 0.5,
  4: 0.7,
  5: 0.9,
};

export type CalibrationBucket = {
  confidence: ConfidenceLevel;
  /** The probability this conviction level claims (0-1). */
  predicted: number;
  count: number;
  correct: number;
  /** Actual accuracy in this bucket (0-1), or null when empty. */
  accuracy: number | null;
};

export type CalibrationReport = {
  /** Questions that carried a conviction rating. */
  rated: number;
  /** Brier score over rated questions (0 = perfect, 1 = worst). Lower is better. */
  brier: number;
  /** Per-level buckets, conviction 1..5. */
  buckets: CalibrationBucket[];
  /** Confident (>=4) yet wrong — the dangerous quadrant. */
  overconfident: number;
  /** Hesitant (<=2) yet correct — money left on the table. */
  underconfident: number;
  /**
   * Signed gap = mean(predicted) - mean(outcome). Positive = overconfident
   * overall; negative = underconfident.
   */
  bias: number;
};

const LEVELS: ConfidenceLevel[] = [1, 2, 3, 4, 5];

function hasConfidence(
  r: TelemetryRecord,
): r is TelemetryRecord & { confidence: ConfidenceLevel } {
  return r.confidence != null;
}

/**
 * Build a calibration report from telemetry records. Returns null when no
 * question was rated (so the debrief simply hides the panel). Works over any
 * record set — one race (debrief) or many (season aggregate).
 */
export function computeCalibration(
  records: TelemetryRecord[],
): CalibrationReport | null {
  const rated = records.filter(hasConfidence);
  if (rated.length === 0) return null;

  const buckets: CalibrationBucket[] = LEVELS.map((c) => {
    const items = rated.filter((r) => r.confidence === c);
    const correct = items.filter((r) => r.isCorrect).length;
    return {
      confidence: c,
      predicted: CONFIDENCE_TO_P[c],
      count: items.length,
      correct,
      accuracy: items.length ? correct / items.length : null,
    };
  });

  let brierSum = 0;
  let predictedSum = 0;
  let outcomeSum = 0;
  for (const r of rated) {
    const p = CONFIDENCE_TO_P[r.confidence];
    const o = r.isCorrect ? 1 : 0;
    brierSum += (p - o) ** 2;
    predictedSum += p;
    outcomeSum += o;
  }
  const n = rated.length;
  const round3 = (x: number) => Math.round(x * 1000) / 1000;

  return {
    rated: n,
    brier: round3(brierSum / n),
    buckets,
    overconfident: rated.filter((r) => r.confidence >= 4 && !r.isCorrect).length,
    underconfident: rated.filter((r) => r.confidence <= 2 && r.isCorrect).length,
    bias: round3((predictedSum - outcomeSum) / n),
  };
}
