import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth";
import { QUESTION_ANGLES } from "@/lib/variations/types";
import { generateVariants, VariationError } from "@/lib/variations/service";
import {
  listVariants,
  loadBaseQuestion,
  saveVariants,
} from "@/lib/variations/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  angles: z.array(z.enum(QUESTION_ANGLES)).max(8).optional(),
  guidance: z.string().max(500).optional(),
});

/** List persisted variants for a base question (any signed-in user). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const variants = await listVariants(id);
  return NextResponse.json({ ok: true, variants });
}

/** Generate + persist variants for a base question (admin only). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const base = await loadBaseQuestion(id);
  if (!base) {
    return NextResponse.json({ error: "question not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const result = await generateVariants(base, {
      angles: parsed.data.angles,
      guidance: parsed.data.guidance,
    });
    const saved = await saveVariants(id, result, auth.user.id);
    return NextResponse.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      learningObjective: result.data.learningObjective,
      variants: saved,
    });
  } catch (err) {
    if (err instanceof VariationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
