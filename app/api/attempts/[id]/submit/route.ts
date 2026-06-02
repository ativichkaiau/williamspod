import { NextResponse } from "next/server";
import { z } from "zod";
import { submitAttempt } from "@/lib/attempts";

const Body = z.object({
  picks: z.record(z.string(), z.number().int().min(-1).max(10).nullable()),
  marked: z.record(z.string(), z.boolean()),
  timeUsedMs: z.number().int().min(0),
  aborted: z.boolean().optional(),
  abortReason: z.string().max(200).nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const result = await submitAttempt({
      attemptId: id,
      picks: parsed.data.picks,
      marked: parsed.data.marked,
      timeUsedMs: parsed.data.timeUsedMs,
      aborted: parsed.data.aborted,
      abortReason: parsed.data.abortReason,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
