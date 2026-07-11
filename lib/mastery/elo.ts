/**
 * Championship ratings — a small ELO engine. Every answered question is a race
 * against an "opponent" whose strength comes from the question's difficulty:
 * beating a hard question gains more than beating an easy one, and missing an
 * easy one costs more. Ratings start at BASE_RATING and evolve across sessions.
 */

export const BASE_RATING = 1000;

/** Rating change sensitivity. Higher = faster-moving, noisier standings. */
const K = 24;

/** Map question difficulty (1 easy · 2 medium · 3 hard) to an opponent rating. */
export function difficultyToOpponent(
  difficulty: number | null | undefined,
): number {
  switch (difficulty) {
    case 1:
      return 900;
    case 3:
      return 1150;
    case 2:
    default:
      return 1000;
  }
}

/** One ELO step. `correct` scores 1, a miss scores 0. Returns the new rating. */
export function eloStep(
  rating: number,
  opponent: number,
  correct: boolean,
): number {
  const expected = 1 / (1 + Math.pow(10, (opponent - rating) / 400));
  const score = correct ? 1 : 0;
  return rating + K * (score - expected);
}

/** Days of no practice for a rating's distance-from-base to halve (forgetting). */
const DECAY_HALF_LIFE_DAYS = 60;
const DAY_MS = 86_400_000;

/**
 * Skill fades without practice: pull a rating toward BASE_RATING by how long
 * it's gone untouched. A gain of +200 loses half its edge after ~60 idle days.
 * Applied both when displaying a rating and as the starting point of the next
 * update, so the stored value and the shown value stay consistent.
 */
export function decayRating(
  rating: number,
  updatedAtMs: number,
  nowMs: number,
): number {
  const days = Math.max(0, (nowMs - updatedAtMs) / DAY_MS);
  if (days === 0) return rating;
  const factor = Math.pow(0.5, days / DECAY_HALF_LIFE_DAYS);
  return Math.round(BASE_RATING + (rating - BASE_RATING) * factor);
}
