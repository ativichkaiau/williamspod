import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth";
import { createAttempt } from "@/lib/attempts";
import { recommend, RECOMMEND_DEFAULT_MAX } from "@/lib/review/recommend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  maxQuestions: z.number().int().min(1).max(200).optional(),
  /** Seconds per question for the timer; default 60. */
  perQuestionSec: z.number().int().min(15).max(600).optional(),
});

/**
 * Build and start a Recommended test: due spaced-repetition items first, then
 * lapsed questions, then fresh ones to fill. Own account only.
 */
export async function POST(req: Request) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const max = parsed.success ? parsed.data.maxQuestions ?? RECOMMEND_DEFAULT_MAX : RECOMMEND_DEFAULT_MAX;
  const perQ = parsed.success ? parsed.data.perQuestionSec ?? 60 : 60;

  const rec = await recommend(auth.user.id, { max });
  if (rec.questionIds.length === 0) {
    return NextResponse.json(
      { error: "No questions to review yet — take a test first." },
      { status: 400 },
    );
  }

  try {
    const setup = await createAttempt({
      userId: auth.user.id,
      mode: "weak",
      lectureIds: [],
      questionIds: rec.questionIds,
      durationMs: Math.max(60_000, rec.questionIds.length * perQ * 1000),
      label: "Review test",
      shuffleQuestions: false, // keep due-first priority order
      shuffleChoices: true,
      useVariants: false,
    });
    return NextResponse.json({
      ok: true,
      attemptId: setup.attempt.id,
      questionCount: setup.attempt.questionCount,
      dueCount: rec.dueCount,
      weakCount: rec.weakCount,
      freshCount: rec.freshCount,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
