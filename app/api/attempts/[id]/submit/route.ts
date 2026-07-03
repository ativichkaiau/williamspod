import { NextResponse } from "next/server";
import { z } from "zod";
import { findAttemptForUser, submitAttempt } from "@/lib/attempts";
import { apiAuth } from "@/lib/auth";

const Metrics = z.object({
  timeTakenMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
  clickCount: z.number().int().min(0).max(1000).optional(),
  answerChangeCount: z.number().int().min(0).max(1000).optional(),
  revisitCount: z.number().int().min(0).max(1000).optional(),
  confidence: z.number().int().min(1).max(5).nullable().optional(),
});

const Body = z.object({
  picks: z.record(z.string(), z.number().int().min(-1).max(10).nullable()),
  marked: z.record(z.string(), z.boolean()),
  timeUsedMs: z.number().int().min(0),
  aborted: z.boolean().optional(),
  abortReason: z.string().max(200).nullable().optional(),
  telemetry: z.record(z.string(), Metrics).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const attempt = await findAttemptForUser(id, auth.user.id);
  if (!attempt) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const result = await submitAttempt({
      attemptId: id,
      picks: parsed.data.picks,
      marked: parsed.data.marked,
      timeUsedMs: parsed.data.timeUsedMs,
      aborted: parsed.data.aborted,
      abortReason: parsed.data.abortReason,
      telemetry: parsed.data.telemetry,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
