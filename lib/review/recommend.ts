import { isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { randomSeed, seededShuffle } from "@/lib/rng";
import {
  listDueQuestionIds,
  listLapsingQuestionIds,
  listScheduledQuestionIds,
} from "./store";

export const RECOMMEND_DEFAULT_MAX = 25;

export interface Recommendation {
  /** Base question ids, priority order: due → lapsing → fresh. */
  questionIds: string[];
  dueCount: number;
  weakCount: number;
  freshCount: number;
}

/**
 * Build a "review test" for a user: everything that's due for spaced repetition
 * first, then questions they've lapsed on, then fresh questions to top it up.
 * Only returns questions that still exist and aren't archived.
 */
export async function recommend(
  userId: string,
  opts: { max?: number; seed?: number; now?: Date } = {},
): Promise<Recommendation> {
  const max = Math.max(1, Math.min(opts.max ?? RECOMMEND_DEFAULT_MAX, 200));
  const now = opts.now ?? new Date();

  // Valid (non-archived) question ids in the bank.
  const bankRows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(isNull(questions.archivedAt));
  const valid = new Set(bankRows.map((r) => r.id));

  const picked: string[] = [];
  const seen = new Set<string>();
  const add = (ids: string[]) => {
    for (const id of ids) {
      if (picked.length >= max) break;
      if (!valid.has(id) || seen.has(id)) continue;
      seen.add(id);
      picked.push(id);
    }
  };

  const due = (await listDueQuestionIds(userId, max, now)).filter((id) =>
    valid.has(id),
  );
  add(due);
  const dueCount = picked.length;

  if (picked.length < max) {
    const lapsing = (await listLapsingQuestionIds(userId, max, now)).filter(
      (id) => valid.has(id),
    );
    add(lapsing);
  }
  const weakCount = picked.length - dueCount;

  if (picked.length < max) {
    const scheduled = await listScheduledQuestionIds(userId);
    const fresh = bankRows
      .map((r) => r.id)
      .filter((id) => !scheduled.has(id) && !seen.has(id));
    add(seededShuffle(fresh, opts.seed ?? randomSeed()));
  }
  const freshCount = picked.length - dueCount - weakCount;

  return { questionIds: picked, dueCount, weakCount, freshCount };
}
