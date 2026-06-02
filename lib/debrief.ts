import { eq, inArray, asc } from "drizzle-orm";
import { db } from "./db";
import {
  attempts,
  attemptAnswers,
  integrityEvents,
  lectures,
  questions,
  type Attempt,
  type Question,
} from "./db/schema";

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
};

export async function loadDebrief(attemptId: string): Promise<DebriefData | null> {
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
  if (!attempt) return null;

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
    };
  }

  const qids = ans.map((a) => a.questionId);
  const qrows = await db.select().from(questions).where(inArray(questions.id, qids));
  const qById = new Map<string, Question>(qrows.map((q) => [q.id, q] as const));

  const lectureIds = Array.from(new Set(qrows.map((q) => q.lectureId)));
  const lectureRows =
    lectureIds.length > 0
      ? await db.select().from(lectures).where(inArray(lectures.id, lectureIds))
      : [];
  const lectureNameById = new Map(lectureRows.map((l) => [l.id, l.name] as const));

  // Tally per-lecture and per-topic
  const sectorAcc = new Map<string, { name: string; total: number; correct: number }>();
  const topicAcc = new Map<string, { name: string; total: number; correct: number }>();
  const wrong: WrongAnswer[] = [];
  let correct = 0;
  let unanswered = 0;

  for (const a of ans) {
    const q = qById.get(a.questionId);
    const isCorrect = a.isCorrect === true;
    if (isCorrect) correct++;
    if (a.pickedShownIndex < 0) unanswered++;

    const lecKey = q?.lectureId ?? "unknown";
    const lecName = q ? lectureNameById.get(q.lectureId) ?? "Unknown" : "Deleted";
    const lec = sectorAcc.get(lecKey) ?? { name: lecName, total: 0, correct: 0 };
    lec.total++;
    if (isCorrect) lec.correct++;
    sectorAcc.set(lecKey, lec);

    const topicKey = (q?.topic ?? "Untagged").trim() || "Untagged";
    const top = topicAcc.get(topicKey) ?? { name: topicKey, total: 0, correct: 0 };
    top.total++;
    if (isCorrect) top.correct++;
    topicAcc.set(topicKey, top);

    if (!isCorrect && q) {
      const sourcePicked =
        a.pickedShownIndex >= 0 && a.pickedShownIndex < a.shownChoices.length
          ? a.shownChoices[a.pickedShownIndex]
          : -1;
      wrong.push({
        questionId: q.id,
        questionOrder: a.questionOrder,
        stem: q.stem,
        choices: q.choices,
        correctIndex: q.correctIndex,
        pickedSourceIndex: sourcePicked,
        shownChoices: a.shownChoices,
        explanation: q.explanation,
        lectureName: lectureNameById.get(q.lectureId) ?? null,
        topic: q.topic,
        marked: a.markedForReview,
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
