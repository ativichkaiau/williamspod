import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions, questionVariants } from "@/lib/db/schema";
import { listTelemetryForUser } from "@/lib/telemetry/store";

/**
 * Weak-concept clustering — groups a user's misses by *concept* across every
 * test they've taken, not just by lecture. The concept key is the variant's
 * conceptTag when the served item was a variant, else the base question's
 * topic. Surfaces the ideas you keep missing however they're framed.
 */

const UNTAGGED = "Untagged";

export interface WeakConcept {
  concept: string;
  /** Times a question under this concept was answered. */
  total: number;
  /** Times it was missed. */
  wrong: number;
  /** Miss rate 0-100 (one decimal). */
  missRate: number;
  /** Subjects this concept shows up under. */
  subjects: string[];
}

function clean(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t && t !== UNTAGGED ? t : null;
}

/**
 * Rank the concepts a user misses most. Only concepts seen at least `minSeen`
 * times qualify, so a single fluke doesn't top the list.
 */
export async function loadWeakConcepts(
  userId: string,
  opts: { limit?: number; minSeen?: number } = {},
): Promise<WeakConcept[]> {
  const limit = opts.limit ?? 8;
  const minSeen = opts.minSeen ?? 2;

  const tel = await listTelemetryForUser(userId);
  if (tel.length === 0) return [];

  // Resolve concept keys: variant conceptTag, else base topic.
  const questionIds = Array.from(new Set(tel.map((t) => t.questionId)));
  const variantIds = Array.from(
    new Set(tel.map((t) => t.variantId).filter((v): v is string => !!v)),
  );

  const qRows = questionIds.length
    ? await db
        .select({ id: questions.id, topic: questions.topic })
        .from(questions)
        .where(inArray(questions.id, questionIds))
    : [];
  const topicByQuestion = new Map(qRows.map((r) => [r.id, r.topic] as const));

  const vRows = variantIds.length
    ? await db
        .select({ id: questionVariants.id, conceptTag: questionVariants.conceptTag })
        .from(questionVariants)
        .where(inArray(questionVariants.id, variantIds))
    : [];
  const tagByVariant = new Map(vRows.map((r) => [r.id, r.conceptTag] as const));

  const acc = new Map<
    string,
    { total: number; wrong: number; subjects: Set<string> }
  >();
  for (const t of tel) {
    const concept =
      (t.variantId ? clean(tagByVariant.get(t.variantId)) : null) ??
      clean(topicByQuestion.get(t.questionId)) ??
      UNTAGGED;
    if (concept === UNTAGGED) continue; // no concept signal — skip

    const e = acc.get(concept) ?? { total: 0, wrong: 0, subjects: new Set<string>() };
    e.total++;
    if (!t.isCorrect) e.wrong++;
    if (t.subject) e.subjects.add(t.subject);
    acc.set(concept, e);
  }

  return Array.from(acc.entries())
    .map(([concept, e]) => ({
      concept,
      total: e.total,
      wrong: e.wrong,
      missRate: e.total > 0 ? Math.round((e.wrong / e.total) * 1000) / 10 : 0,
      subjects: Array.from(e.subjects).sort(),
    }))
    .filter((c) => c.total >= minSeen && c.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || b.missRate - a.missRate)
    .slice(0, limit);
}
