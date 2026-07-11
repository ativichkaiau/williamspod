import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { masteryRatings, type MasteryRatingRow } from "@/lib/db/schema";
import { uid } from "@/lib/utils";
import { BASE_RATING, decayRating, difficultyToOpponent, eloStep } from "./elo";

export type MasteryScope = "subject" | "topic";

/** One answered question's contribution to the standings. */
export interface MasteryItem {
  subject: string | null;
  topic: string | null;
  difficulty: number | null;
  isCorrect: boolean;
}

const HISTORY_CAP = 20;
const UNTAGGED = "Untagged";

type Bucket = { scope: MasteryScope; key: string };

/** Which (scope, key) buckets an item feeds — subject always, topic when tagged. */
function bucketsFor(item: MasteryItem): Bucket[] {
  const out: Bucket[] = [];
  const subject = item.subject?.trim();
  if (subject) out.push({ scope: "subject", key: subject });
  const topic = item.topic?.trim();
  if (topic && topic !== UNTAGGED) out.push({ scope: "topic", key: topic });
  return out;
}

/**
 * Replay one race's answered questions into the runner's standings. Sequential
 * ELO per (scope, key), persisting the post-race rating, a rolling win/answer
 * tally, and one trend point per bucket. Best-effort — never throws into the
 * submit path (callers wrap it).
 */
export async function applyMasteryUpdates(
  userId: string,
  items: MasteryItem[],
  at: Date,
): Promise<void> {
  if (items.length === 0) return;

  // Group each answered item under every bucket it feeds, in run order.
  const perBucket = new Map<string, { bucket: Bucket; items: MasteryItem[] }>();
  for (const item of items) {
    for (const bucket of bucketsFor(item)) {
      const id = `${bucket.scope}::${bucket.key}`;
      const entry = perBucket.get(id) ?? { bucket, items: [] };
      entry.items.push(item);
      perBucket.set(id, entry);
    }
  }
  if (perBucket.size === 0) return;

  const existing = await db
    .select()
    .from(masteryRatings)
    .where(eq(masteryRatings.userId, userId));
  const byKey = new Map<string, MasteryRatingRow>(
    existing.map((r) => [`${r.scope}::${r.key}`, r]),
  );

  const atIso = at.toISOString();
  for (const [id, { bucket, items: bucketItems }] of perBucket) {
    const prev = byKey.get(id) ?? null;
    // Start from the DECAYED prior rating so idle time erodes gains before the
    // new result is applied (keeps stored + displayed ratings consistent).
    const startRating = prev
      ? decayRating(prev.rating, new Date(prev.updatedAt).getTime(), at.getTime())
      : BASE_RATING;

    let rating = startRating;
    let correct = 0;
    for (const item of bucketItems) {
      rating = eloStep(
        rating,
        difficultyToOpponent(item.difficulty),
        item.isCorrect,
      );
      if (item.isCorrect) correct++;
    }
    const newRating = Math.round(rating);
    const history = [
      ...((prev?.history ?? []) as { at: string; rating: number }[]),
      { at: atIso, rating: newRating },
    ].slice(-HISTORY_CAP);

    if (prev) {
      await db
        .update(masteryRatings)
        .set({
          rating: newRating,
          races: prev.races + 1,
          answered: prev.answered + bucketItems.length,
          correct: prev.correct + correct,
          lastDelta: newRating - startRating,
          history,
          updatedAt: at,
        })
        .where(eq(masteryRatings.id, prev.id));
    } else {
      await db.insert(masteryRatings).values({
        id: uid("mr"),
        userId,
        scope: bucket.scope,
        key: bucket.key,
        rating: newRating,
        races: 1,
        answered: bucketItems.length,
        correct,
        lastDelta: newRating - startRating,
        history,
        updatedAt: at,
      });
    }
  }
}

export interface StandingRow {
  key: string;
  rating: number;
  races: number;
  answered: number;
  correct: number;
  /** Accuracy 0-100 (one decimal). */
  accuracy: number;
  lastDelta: number;
  history: { at: string; rating: number }[];
  /** True when idle-time decay has pulled the rating noticeably below its peak. */
  rusty: boolean;
}

function toRow(r: MasteryRatingRow, nowMs: number): StandingRow {
  const decayed = decayRating(r.rating, new Date(r.updatedAt).getTime(), nowMs);
  return {
    key: r.key,
    rating: decayed,
    races: r.races,
    answered: r.answered,
    correct: r.correct,
    accuracy:
      r.answered > 0 ? Math.round((r.correct / r.answered) * 1000) / 10 : 0,
    lastDelta: r.lastDelta,
    history: (r.history as { at: string; rating: number }[]) ?? [],
    rusty: r.rating - decayed >= 10,
  };
}

/** The user's full standings, each scope ranked by rating (top first). */
export async function loadStandings(
  userId: string,
): Promise<{ subjects: StandingRow[]; topics: StandingRow[] }> {
  const rows = await db
    .select()
    .from(masteryRatings)
    .where(eq(masteryRatings.userId, userId));
  const now = Date.now();
  const map = (r: MasteryRatingRow) => toRow(r, now);
  const byRating = (a: StandingRow, b: StandingRow) => b.rating - a.rating;
  return {
    subjects: rows.filter((r) => r.scope === "subject").map(map).sort(byRating),
    topics: rows.filter((r) => r.scope === "topic").map(map).sort(byRating),
  };
}

/** Compact per-subject summary for the WilliamsSync packet. */
export interface MasterySummary {
  scope: MasteryScope;
  key: string;
  rating: number;
  delta: number;
  races: number;
  accuracy: number;
}

export async function masterySummary(
  userId: string,
): Promise<MasterySummary[]> {
  const { subjects } = await loadStandings(userId);
  return subjects.map((s) => ({
    scope: "subject",
    key: s.key,
    rating: s.rating,
    delta: s.lastDelta,
    races: s.races,
    accuracy: s.accuracy,
  }));
}
