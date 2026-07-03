/**
 * Returns the logged-in user's WilliamsSync export token. Session-authed (NOT a
 * public path) — only the owner, logged into WilliamsPod, can mint their token.
 * Paste the token + this origin into WilliamsHub → Repair → Connect WilliamsPod.
 */

import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth";
import { issueExportToken } from "@/lib/sync/exportToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const token = await issueExportToken(auth.user.id);
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    token,
    origin,
    exportUrl: `${origin}/api/sync/export?token=${token}`,
    note: "Paste `origin` and `token` into WilliamsHub → Repair → Connect WilliamsPod.",
  });
}
