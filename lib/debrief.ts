import { eq, inArray, asc } from "drizzle-orm";
import { db } from "./db";
import {
  attempts,
  attemptAnswers,
  integrityEvents,
  lectures,
  type Attempt,
} from "./db/schema";
import { resolveEffectiveItems } from "./variations/effective";
import { ANGLE_META, type QuestionAngle } from "./variations/types";
import {
  listTelemetryForAttempt,
  summarize,
  type TelemetrySummary,
} from "./telemetry/store";
import { computeCalibration, type CalibrationReport } from "./telemetry/calibration";
import type { ErrorType, TimingCategory } from "./telemetry/types";
import { computeTiming } from "./timing/service";
import type { QuestionDifficulty, QuestionType } from "./timing/types";

export type SectorRow = {
  key: string;
  name: string;
  total: number;
  correct: number;
  pct: number;
};

export type WrongAnswer = {
  questionId: string;
  questionOrder: number;
  stem: string;
  choices: string[];
  /** Source index of correct answer in `choices`. */
  correctIndex: number;
  /** Source index the user picked, or -1. */
  pickedSourceIndex: number;
  /** Shown order of choices for this attempt — useful if you want to render the order they saw. */
  shownChoices: number[];
  explanation: string | null;
  lectureName: string | null;
  topic: string | null;
  marked: boolean;
  /** Provenance when this item was served as a concept variant. */
  isVariant: boolean;
  angleLabel: string | null;
  /** Telemetry classification (present when the run recorded metrics). */
  timingCategory: TimingCategory | null;
  errorType: ErrorType | null;
};

/** One question's pace, in the order the runner drove it. */
export type PacingPoint = {
  /** 1-based question order. */
  order: number;
  questionId: string;
  /** Actual seconds spent on the question. */
  timeSec: number;
  /** Adaptive time budget for this question type/difficulty (seconds). */
  budgetSec: number;
  questionType: QuestionType;
  timingCategory: TimingCategory | null;
  isCorrect: boolean;
  answered: boolean;
};

export type DebriefData = {
  attempt: Attempt;
  totals: { correct: number; total: number; unanswered: number; pct: number };
  bySector: SectorRow[];
  byTopic: SectorRow[];
  weakestSector: SectorRow | null;
  weakestTopic: SectorRow | null;
  wrongAnswers: WrongAnswer[];
  integrityTimeline: {
    id: string;
    kind: string;
    elapsedMs: number;
    occurredAt: Date;
    detail: string | null;
  }[];
  /** Timing + error-classification telemetry (null when the run recorded none). */
  telemetry: TelemetrySummary | null;
  /** Per-question pace in run order (empty when the run recorded no telemetry). */
  pacing: PacingPoint[];
  /** Confidence calibration (null unless the runner rated confidence). */
  calibration: CalibrationReport | null;
};

export async function loadDebrief(
  attemptId: string,
  userId?: string,
): Promise<DebriefData | null> {
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
  if (!attempt) return null;
  if (userId !== undefined && attempt.userId !== userId) return null;

  const ans = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId))
    .orderBy(asc(attemptAnswers.questionOrder));

  if (ans.length === 0) {
    return {
      attempt,
      totals: { correct: 0, total: 0, unanswered: 0, pct: 0 },
      bySector: [],
      byTopic: [],
      weakestSector: null,
      weakestTopic: null,
      wrongAnswers: [],
      integrityTimeline: [],
      telemetry: null,
      pacing: [],
      calibration: null,
    };
  }

  // Resolve each answer to its effective item (variant or base). lectureId /
  // topic always come from the base question, so sector telemetry is unaffected.
  const effective = await resolveEffectiveItems(ans);

  // Per-question telemetry classification (timing category + error type).
  const telemetryRecords = await listTelemetryForAttempt(attemptId);
  const telByQuestion = new Map(
    telemetryRecords.map((t) => [t.questionId, t] as const),
  );

  const lectureIds = Array.from(
    new Set(
      Array.from(effective.values())
        .map((e) => e.lectureId)
        .filter((id) => id),
    ),
  );
  const lectureRows =
    lectureIds.length > 0
      ? await db.select().from(lectures).where(inArray(lectures.id, lectureIds))
      : [];
  const lectureNameById = new Map(lectureRows.map((l) => [l.id, l.name] as const));

  // Tally per-lecture and per-topic
  const sectorAcc = new Map<string, { name: string; total: number; correct: number }>();
  const topicAcc = new Map<string, { name: string; total: number; correct: number }>();
  const wrong: WrongAnswer[] = [];
  const pacing: PacingPoint[] = [];
  let correct = 0;
  let unanswered = 0;

  for (const a of ans) {
    const eff = effective.get(a.id);
    const isCorrect = a.isCorrect === true;
    if (isCorrect) correct++;
    if (a.pickedShownIndex < 0) unanswered++;

    // Lap-time pace (in run order) — only for questions the run instrumented.
    const tel = eff && !eff.missing ? telByQuestion.get(eff.questionId) : undefined;
    if (tel) {
      pacing.push({
        order: a.questionOrder + 1,
        questionId: tel.questionId,
        timeSec: Math.round(tel.timeTakenMs / 1000),
        budgetSec: computeTiming({
          questionType: tel.questionType,
          difficulty:
            (eff!.difficulty as QuestionDifficulty | null) ?? undefined,
        }).recommendedSeconds,
        questionType: tel.questionType,
        timingCategory: tel.timingCategory,
        isCorrect: tel.isCorrect,
        answered: tel.selectedIndex >= 0,
      });
    }

    const lecKey = eff && !eff.missing ? eff.lectureId : "unknown";
    const lecName =
      eff && !eff.missing
        ? lectureNameById.get(eff.lectureId) ?? "Unknown"
        : "Deleted";
    const lec = sectorAcc.get(lecKey) ?? { name: lecName, total: 0, correct: 0 };
    lec.total++;
    if (isCorrect) lec.correct++;
    sectorAcc.set(lecKey, lec);

    const topicKey = (eff?.topic ?? "Untagged").trim() || "Untagged";
    const top = topicAcc.get(topicKey) ?? { name: topicKey, total: 0, correct: 0 };
    top.total++;
    if (isCorrect) top.correct++;
    topicAcc.set(topicKey, top);

    if (!isCorrect && eff && !eff.missing) {
      const sourcePicked =
        a.pickedShownIndex >= 0 && a.pickedShownIndex < a.shownChoices.length
          ? a.shownChoices[a.pickedShownIndex]
          : -1;
      wrong.push({
        questionId: eff.questionId,
        questionOrder: a.questionOrder,
        stem: eff.stem,
        choices: eff.choices,
        correctIndex: eff.correctIndex,
        pickedSourceIndex: sourcePicked,
        shownChoices: a.shownChoices,
        explanation: eff.explanation,
        lectureName: lectureNameById.get(eff.lectureId) ?? null,
        topic: eff.topic,
        marked: a.markedForReview,
        isVariant: !!eff.variantId,
        angleLabel: eff.angle ? ANGLE_META[eff.angle as QuestionAngle].label : null,
        timingCategory: telByQuestion.get(eff.questionId)?.timingCategory ?? null,
        errorType: telByQuestion.get(eff.questionId)?.errorType ?? null,
      });
    }
  }

  const bySector: SectorRow[] = Array.from(sectorAcc.entries())
    .map(([key, v]) => ({
      key,
      name: v.name,
      total: v.total,
      correct: v.correct,
      pct: v.total > 0 ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.pct - b.pct);

  const byTopic: SectorRow[] = Array.from(topicAcc.entries())
    .map(([key, v]) => ({
      key,
      name: v.name,
      total: v.total,
      correct: v.correct,
      pct: v.total > 0 ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.pct - b.pct);

  // Only call something "weakest" if it has >= 2 questions in the run, so single-Q
  // sectors don't get unfairly tagged. Fall back to the lowest if none meet that.
  const significant = (rows: SectorRow[]) =>
    rows.filter((r) => r.total >= 2)[0] ?? rows[0] ?? null;

  const events = await db
    .select()
    .from(integrityEvents)
    .where(eq(integrityEvents.attemptId, attemptId))
    .orderBy(asc(integrityEvents.elapsedMs));

  return {
    attempt,
    totals: {
      correct,
      total: ans.length,
      unanswered,
      pct: ans.length > 0 ? Math.round((correct / ans.length) * 1000) / 10 : 0,
    },
    bySector,
    byTopic,
    weakestSector: significant(bySector),
    weakestTopic: significant(byTopic),
    wrongAnswers: wrong.sort((a, b) => a.questionOrder - b.questionOrder),
    integrityTimeline: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      elapsedMs: e.elapsedMs,
      occurredAt: new Date(e.occurredAt),
      detail: e.detail,
    })),
    telemetry: telemetryRecords.length > 0 ? summarize(telemetryRecords) : null,
    pacing,
    calibration: computeCalibration(telemetryRecords),
  };
}

export type WeakAreaSelection = {
  /** Lecture ids whose pct is below threshold and that have >= minTotal questions. */
  lectureIds: string[];
  topics: string[];
};

export function selectWeakAreas(
  debrief: DebriefData,
  opts?: { threshold?: number; minTotal?: number },
): WeakAreaSelection {
  const threshold = opts?.threshold ?? 70;
  const minTotal = opts?.minTotal ?? 2;
  const weakSectors = debrief.bySector.filter(
    (s) => s.total >= minTotal && s.pct < threshold,
  );
  const weakTopics = debrief.byTopic.filter(
    (t) => t.total >= minTotal && t.pct < threshold,
  );
  return {
    lectureIds: weakSectors.map((s) => s.key),
    topics: weakTopics.map((t) => t.name),
  };
}
