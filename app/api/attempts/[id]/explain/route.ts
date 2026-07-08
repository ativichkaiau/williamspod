import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth";
import { loadDebrief } from "@/lib/debrief";
import { explainMistake } from "@/lib/engineer/explain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ questionId: z.string().min(1) });

/**
 * Race engineer — explain one wrong answer from a finished run. Grounded in the
 * question's own explanation + the run's telemetry; own attempts only.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "questionId required" }, { status: 400 });
  }

  const debrief = await loadDebrief(id, auth.user.id);
  if (!debrief) {
    return NextResponse.json({ error: "attempt not found" }, { status: 404 });
  }

  const w = debrief.wrongAnswers.find(
    (x) => x.questionId === parsed.data.questionId,
  );
  if (!w) {
    return NextResponse.json(
      { error: "no wrong answer for that question in this run" },
      { status: 400 },
    );
  }

  const result = await explainMistake({
    stem: w.stem,
    choices: w.choices,
    correctIndex: w.correctIndex,
    pickedIndex: w.pickedSourceIndex,
    explanation: w.explanation,
    topic: w.topic,
    lectureName: w.lectureName,
    timingCategory: w.timingCategory,
    errorType: w.errorType,
  });

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    text: result.text,
  });
}
