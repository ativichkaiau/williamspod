import { NextResponse } from "next/server";
import { z } from "zod";
import { createAttempt } from "@/lib/attempts";
import { apiAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  mode: z.enum(["full", "lecture", "weak", "custom"]).default("custom"),
  lectureIds: z.array(z.string().min(1)).min(1),
  durationMs: z.number().int().min(60_000).max(8 * 60 * 60 * 1000),
  maxQuestions: z.number().int().min(1).max(500).optional(),
  label: z.string().max(120).optional(),
  shuffleChoices: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const setup = await createAttempt({ ...parsed.data, userId: auth.user.id });
    return NextResponse.json({
      ok: true,
      attemptId: setup.attempt.id,
      questionCount: setup.attempt.questionCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }
}
