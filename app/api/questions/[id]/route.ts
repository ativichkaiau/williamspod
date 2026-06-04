import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { apiAuth } from "@/lib/auth";

const PatchBody = z.object({
  stem: z.string().min(1).max(4000).optional(),
  choices: z.array(z.string().min(1).max(2000)).min(2).max(6).optional(),
  correctIndex: z.number().int().min(0).max(5).optional(),
  explanation: z.string().max(8000).nullable().optional(),
  topic: z.string().max(200).nullable().optional(),
  difficulty: z.number().int().min(1).max(3).nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;
  if (data.choices && data.correctIndex != null && data.correctIndex >= data.choices.length) {
    return NextResponse.json(
      { error: "correctIndex out of range for choices" },
      { status: 400 },
    );
  }
  await db
    .update(questions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(questions.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  await db.delete(questions).where(eq(questions.id, id));
  return NextResponse.json({ ok: true });
}
