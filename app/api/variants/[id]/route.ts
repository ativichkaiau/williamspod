import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth";
import { archiveVariant } from "@/lib/variations/store";

export const dynamic = "force-dynamic";

/** Soft-delete a single variant (admin only). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const ok = await archiveVariant(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
