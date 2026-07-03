import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { questionVariants, questions } from "@/lib/db/schema";
import type { QuestionAngle } from "./types";

/**
 * The "effective" item served for an attempt answer: the variant when one was
 * substituted, otherwise the base question. lectureId/topic ALWAYS come from
 * the base question so per-lecture / per-topic telemetry is unaffected by
 * variant substitution.
 */
export interface EffectiveItem {
  questionId: string;
  variantId: string | null;
  angle: QuestionAngle | null;
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
  lectureId: string;
  topic: string | null;
  /** True when the base question no longer exists (deleted). */
  missing: boolean;
}

type AnswerRef = {
  id: string;
  questionId: string;
  variantId: string | null;
};

/**
 * Batch-resolve effective items for a set of attempt answers.
 * Returns a Map keyed by the attempt-answer id.
 */
export async function resolveEffectiveItems(
  answers: AnswerRef[],
): Promise<Map<string, EffectiveItem>> {
  const questionIds = Array.from(new Set(answers.map((a) => a.questionId)));
  const variantIds = Array.from(
    new Set(answers.map((a) => a.variantId).filter((v): v is string => !!v)),
  );

  const qRows = questionIds.length
    ? await db.select().from(questions).where(inArray(questions.id, questionIds))
    : [];
  const qById = new Map(qRows.map((q) => [q.id, q] as const));

  const vRows = variantIds.length
    ? await db
        .select()
        .from(questionVariants)
        .where(inArray(questionVariants.id, variantIds))
    : [];
  const vById = new Map(vRows.map((v) => [v.id, v] as const));

  const out = new Map<string, EffectiveItem>();
  for (const a of answers) {
    const base = qById.get(a.questionId);
    const variant = a.variantId ? vById.get(a.variantId) : undefined;

    if (!base) {
      out.set(a.id, {
        questionId: a.questionId,
        variantId: a.variantId,
        angle: variant?.angle ?? null,
        stem: variant?.stem ?? "[deleted question]",
        choices: variant?.choices ?? [],
        correctIndex: variant?.correctIndex ?? -1,
        explanation: variant?.explanation ?? null,
        lectureId: "",
        topic: null,
        missing: true,
      });
      continue;
    }

    if (variant) {
      out.set(a.id, {
        questionId: base.id,
        variantId: variant.id,
        angle: variant.angle,
        stem: variant.stem,
        choices: variant.choices,
        correctIndex: variant.correctIndex,
        explanation: variant.explanation,
        lectureId: base.lectureId, // telemetry stays on the base
        topic: base.topic,
        missing: false,
      });
    } else {
      out.set(a.id, {
        questionId: base.id,
        variantId: null,
        angle: null,
        stem: base.stem,
        choices: base.choices,
        correctIndex: base.correctIndex,
        explanation: base.explanation,
        lectureId: base.lectureId,
        topic: base.topic,
        missing: false,
      });
    }
  }
  return out;
}
