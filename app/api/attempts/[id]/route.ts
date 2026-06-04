import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attemptAnswers, attempts, integrityEvents } from "@/lib/db/schema";
import { findAttemptForUser } from "@/lib/attempts";
import { apiAuth } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const attempt = await findAttemptForUser(id, auth.user.id);
  if (!attempt) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await db.delete(integrityEvents).where(eq(integrityEvents.attemptId, id));
  await db.delete(attemptAnswers).where(eq(attemptAnswers.attemptId, id));
  await db.delete(attempts).where(eq(attempts.id, id));

  return NextResponse.json({ ok: true });
}
