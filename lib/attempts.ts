import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  attempts,
  attemptAnswers,
  integrityEvents,
  lectures,
  questions,
  questionVariants,
  type Attempt,
  type AttemptAnswer,
  type Question,
} from "./db/schema";
import { uid } from "./utils";
import { mulberry32, randomSeed, seededShuffle } from "./rng";
import { resolveEffectiveItems } from "./variations/effective";
import type { QuestionAngle } from "./variations/types";

export const INTEGRITY_ABORT_THRESHOLD = 2;
type IntegrityEventKind = typeof integrityEvents.$inferInsert.kind;
const NOISY_INTEGRITY_EVENT_KINDS = new Set<IntegrityEventKind>([
  "blur",
  "visibility_hidden",
  "fullscreen_exit",
]);
const INTEGRITY_EVENT_COALESCE_MS = 2500;

export type CreateAttemptInput = {
  userId: string;
  mode: "full" | "lecture" | "weak" | "custom";
  lectureIds: string[];
  durationMs: number;
  maxQuestions?: number;
  label?: string;
  /** When true, also shuffle the displayed order of answer choices per question. */
  shuffleChoices?: boolean;
  /** When true, shuffle the order of questions. */
  shuffleQuestions?: boolean;
  /** When true, substitute a concept variant for any question that has one. */
  useVariants?: boolean;
  /** Optional seed for deterministic replay. Random if omitted. */
  seed?: number;
};

export type AttemptSetup = {
  attempt: Attempt;
  questions: {
    id: string;
    stem: string;
    /** Display-order choices = the strings to render */
    displayChoices: string[];
    /** Source indices into the effective choices array, in display order */
    shownChoices: number[];
    lectureId: string;
    topic: string | null;
    /** Set when this item is a substituted variant. */
    variantId?: string | null;
    angle?: QuestionAngle | null;
  }[];
};

export async function createAttempt(input: CreateAttemptInput): Promise<AttemptSetup> {
  if (input.lectureIds.length === 0) {
    throw new Error("at least one lecture required");
  }
  // Sanity check that lectures exist + not archived.
  const lecs = await db
    .select({ id: lectures.id })
    .from(lectures)
    .where(and(inArray(lectures.id, input.lectureIds), isNull(lectures.archivedAt)));
  const validLectureIds = lecs.map((l) => l.id);
  if (validLectureIds.length === 0) {
    throw new Error("no valid lectures");
  }

  const pool = await db
    .select()
    .from(questions)
    .where(
      and(inArray(questions.lectureId, validLectureIds), isNull(questions.archivedAt)),
    );

  if (pool.length === 0) {
    throw new Error("no questions in selected lectures");
  }

  const seed = input.seed ?? randomSeed();
  const shuffleQ = input.shuffleQuestions !== false;
  const shuffleC = input.shuffleChoices !== false;

  let ordered: Question[] = shuffleQ ? seededShuffle(pool, seed) : pool.slice();
  if (input.maxQuestions && input.maxQuestions > 0 && input.maxQuestions < ordered.length) {
    ordered = ordered.slice(0, input.maxQuestions);
  }

  const attemptId = uid("att");
  const now = new Date();
  const attemptRow = {
    id: attemptId,
    userId: input.userId,
    label: input.label ?? null,
    mode: input.mode,
    durationMs: input.durationMs,
    timeUsedMs: null,
    startedAt: now,
    submittedAt: null,
    lectureIds: validLectureIds,
    questionCount: ordered.length,
    scoreCorrect: null,
    scoreTotal: null,
    integrityFlagCount: 0,
    aborted: false,
    abortReason: null,
    createdAt: now,
  } satisfies typeof attempts.$inferInsert;

  await db.insert(attempts).values(attemptRow);

  // Optionally pick one variant per question (seeded → reproducible).
  const chosenVariant = new Map<
    string,
    { id: string; stem: string; choices: string[]; correctIndex: number; angle: QuestionAngle }
  >();
  if (input.useVariants) {
    const vrows = await db
      .select()
      .from(questionVariants)
      .where(
        and(
          inArray(
            questionVariants.baseQuestionId,
            ordered.map((q) => q.id),
          ),
          isNull(questionVariants.archivedAt),
        ),
      );
    const byBase = new Map<string, typeof vrows>();
    for (const v of vrows) {
      const arr = byBase.get(v.baseQuestionId) ?? [];
      arr.push(v);
      byBase.set(v.baseQuestionId, arr);
    }
    const variantRng = mulberry32(seed ^ 0x85ebca6b);
    for (const q of ordered) {
      const options = byBase.get(q.id);
      if (options && options.length > 0) {
        const pick = options[Math.floor(variantRng() * options.length)];
        chosenVariant.set(q.id, {
          id: pick.id,
          stem: pick.stem,
          choices: pick.choices,
          correctIndex: pick.correctIndex,
          angle: pick.angle,
        });
      }
    }
  }

  // Derive per-question shown choice permutations using a derived seed so seeds compose deterministically.
  const choiceShuffleSeed = seed ^ 0x9e3779b9;
  const choiceRng = mulberry32(choiceShuffleSeed);

  const setupQuestions: AttemptSetup["questions"] = [];
  for (let i = 0; i < ordered.length; i++) {
    const q = ordered[i];
    const variant = chosenVariant.get(q.id) ?? null;
    // The "effective" item that is actually served + graded.
    const effChoices = variant ? variant.choices : q.choices;
    const effStem = variant ? variant.stem : q.stem;

    const sourceIndices = effChoices.map((_, idx) => idx);
    let shownChoices: number[];
    if (shuffleC) {
      // Pull n random numbers per question so the sequence is deterministic for this attempt.
      shownChoices = sourceIndices.slice();
      for (let k = shownChoices.length - 1; k > 0; k--) {
        const j = Math.floor(choiceRng() * (k + 1));
        [shownChoices[k], shownChoices[j]] = [shownChoices[j], shownChoices[k]];
      }
    } else {
      shownChoices = sourceIndices;
    }

    await db.insert(attemptAnswers).values({
      id: uid("ans"),
      attemptId,
      questionId: q.id, // base question — provenance + telemetry
      variantId: variant?.id ?? null,
      questionOrder: i,
      shownChoices,
      pickedShownIndex: -1,
      isCorrect: null,
      markedForReview: false,
      timeOnQuestionMs: 0,
    });

    setupQuestions.push({
      id: q.id,
      stem: effStem,
      displayChoices: shownChoices.map((s) => effChoices[s]),
      shownChoices,
      lectureId: q.lectureId,
      topic: q.topic,
      variantId: variant?.id ?? null,
      angle: variant?.angle ?? null,
    });
  }

  const [attemptCreated] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, attemptId));
  return { attempt: attemptCreated, questions: setupQuestions };
}

/**
 * Verifies an attempt belongs to a user. Returns the attempt or null.
 * Legacy attempts with NULL userId are treated as owned by no one (admin only).
 */
export async function findAttemptForUser(
  attemptId: string,
  userId: string,
): Promise<Attempt | null> {
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, attemptId));
  if (!attempt) return null;
  if (attempt.userId !== userId) return null;
  return attempt;
}

export async function loadAttemptForRuntime(
  attemptId: string,
  userId?: string,
): Promise<
  | (AttemptSetup & {
      answers: Pick<AttemptAnswer, "questionId" | "pickedShownIndex" | "markedForReview">[];
    })
  | null
> {
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
  if (!attempt) return null;
  if (userId !== undefined && attempt.userId !== userId) return null;

  const ans = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId))
    .orderBy(attemptAnswers.questionOrder);

  if (ans.length === 0) return null;

  // Resolve each answer to its effective item (variant or base question).
  const effective = await resolveEffectiveItems(ans);

  const setupQuestions: AttemptSetup["questions"] = ans.map((a) => {
    const eff = effective.get(a.id)!;
    return {
      id: a.questionId,
      stem: eff.missing ? "[deleted question]" : eff.stem,
      displayChoices: a.shownChoices.map((s) => eff.choices[s] ?? ""),
      shownChoices: a.shownChoices,
      lectureId: eff.lectureId,
      topic: eff.topic,
      variantId: eff.variantId,
      angle: eff.angle,
    };
  });

  return {
    attempt,
    questions: setupQuestions,
    answers: ans.map((a) => ({
      questionId: a.questionId,
      pickedShownIndex: a.pickedShownIndex,
      markedForReview: a.markedForReview,
    })),
  };
}

export type SubmitInput = {
  attemptId: string;
  /** Map of questionId → display-order picked index. -1 / undefined = unanswered. */
  picks: Record<string, number | null | undefined>;
  marked: Record<string, boolean | undefined>;
  timeUsedMs: number;
  aborted?: boolean;
  abortReason?: string | null;
};

export type SubmitResult = {
  attemptId: string;
  scoreCorrect: number;
  scoreTotal: number;
  aborted: boolean;
};

export async function submitAttempt(input: SubmitInput): Promise<SubmitResult> {
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, input.attemptId));
  if (!attempt) throw new Error("attempt not found");
  if (attempt.submittedAt) {
    return {
      attemptId: attempt.id,
      scoreCorrect: attempt.scoreCorrect ?? 0,
      scoreTotal: attempt.scoreTotal ?? 0,
      aborted: attempt.aborted,
    };
  }

  const ans = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, input.attemptId));
  // Grade against the EFFECTIVE item (variant when substituted, else base).
  const effective = await resolveEffectiveItems(ans);

  let correct = 0;
  const now = new Date();

  for (const a of ans) {
    const eff = effective.get(a.id);
    if (!eff || eff.missing) {
      await db
        .update(attemptAnswers)
        .set({ isCorrect: false })
        .where(eq(attemptAnswers.id, a.id));
      continue;
    }
    const pickedShown = input.picks[a.questionId];
    const marked = !!input.marked[a.questionId];
    const picked =
      pickedShown == null || pickedShown < 0 || pickedShown >= a.shownChoices.length
        ? -1
        : pickedShown;
    const sourceIndex = picked >= 0 ? a.shownChoices[picked] : -1;
    const isCorrect = sourceIndex === eff.correctIndex;
    if (isCorrect) correct++;
    await db
      .update(attemptAnswers)
      .set({
        pickedShownIndex: picked,
        markedForReview: marked,
        isCorrect,
      })
      .where(eq(attemptAnswers.id, a.id));
  }

  await db
    .update(attempts)
    .set({
      submittedAt: now,
      timeUsedMs: Math.max(0, Math.round(input.timeUsedMs)),
      scoreCorrect: correct,
      scoreTotal: ans.length,
      aborted: !!input.aborted,
      abortReason: input.aborted ? input.abortReason ?? "lockdown" : null,
    })
    .where(eq(attempts.id, input.attemptId));

  return {
    attemptId: input.attemptId,
    scoreCorrect: correct,
    scoreTotal: ans.length,
    aborted: !!input.aborted,
  };
}

export async function recordIntegrityEvent(opts: {
  attemptId: string;
  kind: IntegrityEventKind;
  elapsedMs: number;
  detail?: string | null;
}) {
  const now = new Date();
  const existingEvents = await db
    .select()
    .from(integrityEvents)
    .where(eq(integrityEvents.attemptId, opts.attemptId));

  if (NOISY_INTEGRITY_EVENT_KINDS.has(opts.kind)) {
    const lastNoisyEvent = existingEvents
      .filter((event) => NOISY_INTEGRITY_EVENT_KINDS.has(event.kind))
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      )[0];
    if (
      lastNoisyEvent &&
      now.getTime() - new Date(lastNoisyEvent.occurredAt).getTime() <
        INTEGRITY_EVENT_COALESCE_MS
    ) {
      return { total: existingEvents.length, recorded: false };
    }
  }

  await db.insert(integrityEvents).values({
    id: uid("ev"),
    attemptId: opts.attemptId,
    kind: opts.kind,
    occurredAt: now,
    elapsedMs: Math.max(0, Math.round(opts.elapsedMs)),
    detail: opts.detail ?? null,
  });
  // Cache count on attempt for cheap listing.
  const events = await db
    .select({ id: integrityEvents.id })
    .from(integrityEvents)
    .where(eq(integrityEvents.attemptId, opts.attemptId));
  await db
    .update(attempts)
    .set({ integrityFlagCount: events.length })
    .where(eq(attempts.id, opts.attemptId));
  return { total: events.length, recorded: true };
}
