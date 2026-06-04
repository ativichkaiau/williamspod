import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { apiAuth } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const [row] = await db.select().from(invites).where(eq(invites.id, id));
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (row.usedAt) {
    return NextResponse.json({ error: "already used" }, { status: 409 });
  }
  await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(eq(invites.id, id));
  return NextResponse.json({ ok: true });
}
