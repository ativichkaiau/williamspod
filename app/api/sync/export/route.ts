/**
 * WilliamsSync export — the endpoint WilliamsHub PULLS from.
 *
 * Public path (see middleware.ts) but token-gated: requires a valid export token
 * (?token= or Authorization: Bearer) that resolves to a user. Returns that user's
 * recent runs as PodTelemetryPacket[]. CORS-enabled so a WilliamsHub browser on
 * another origin can read it.
 */

import { NextResponse } from "next/server";
import { verifyExportToken } from "@/lib/sync/exportToken";
import { buildPodTelemetryPacket, } from "@/lib/sync/outbound";
import { SYNC_PACKET_VERSION } from "@/lib/sync/types";
import { listTelemetryForUser } from "@/lib/telemetry/store";
import type { TelemetryRecord } from "@/lib/telemetry/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "cache-control": "no-store",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = url.searchParams.get("token") ?? bearer;
  const userId = await verifyExportToken(token);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 25, 1), 100);

  const telemetry = await listTelemetryForUser(userId);
  const byAttempt = new Map<string, TelemetryRecord[]>();
  for (const t of telemetry) {
    const arr = byAttempt.get(t.attemptId) ?? [];
    arr.push(t);
    byAttempt.set(t.attemptId, arr);
  }

  const recentAttempts = [...byAttempt.entries()]
    .map(([attemptId, recs]) => ({
      attemptId,
      recs,
      last: recs.reduce((m, r) => (r.attemptedAt > m ? r.attemptedAt : m), ""),
    }))
    .sort((a, b) => b.last.localeCompare(a.last))
    .slice(0, limit);

  const packets = recentAttempts.map(({ attemptId, recs }) =>
    buildPodTelemetryPacket(attemptId, userId, recs),
  );

  return NextResponse.json(
    { version: SYNC_PACKET_VERSION, source: "williamspod", generatedAt: new Date().toISOString(), packets },
    { headers: CORS },
  );
}
