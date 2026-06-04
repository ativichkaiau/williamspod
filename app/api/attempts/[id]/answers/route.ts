import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { attemptAnswers } from "@/lib/db/schema";
import { findAttemptForUser } from "@/lib/attempts";
import { apiAuth } from "@/lib/auth";

const Body = z.object({
  picks: z.record(z.string(), z.number().int().min(-1).max(10)).optional(),
  marked: z.record(z.string(), z.boolean()).optional(),
  timeOnQuestion: z.record(z.string(), z.number().int().min(0)).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const attempt = await findAttemptForUser(id, auth.user.id);
  if (!attempt) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (attempt.submittedAt) {
    return NextResponse.json({ error: "already submitted" }, { status: 409 });
  }
  const { picks = {}, marked = {}, timeOnQuestion = {} } = parsed.data;
  const qids = new Set<string>([
    ...Object.keys(picks),
    ...Object.keys(marked),
    ...Object.keys(timeOnQuestion),
  ]);
  for (const qid of qids) {
    const updates: Partial<typeof attemptAnswers.$inferInsert> = {};
    if (qid in picks) updates.pickedShownIndex = picks[qid];
    if (qid in marked) updates.markedForReview = marked[qid];
    if (qid in timeOnQuestion) updates.timeOnQuestionMs = timeOnQuestion[qid];
    if (Object.keys(updates).length === 0) continue;
    await db
      .update(attemptAnswers)
      .set(updates)
      .where(
        and(eq(attemptAnswers.attemptId, id), eq(attemptAnswers.questionId, qid)),
      );
  }
  return NextResponse.json({ ok: true });
}
