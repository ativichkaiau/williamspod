import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth";
import { listTelemetryForAttempt } from "@/lib/telemetry/store";
import { findAttemptForUser } from "@/lib/attempts";
import { buildPodTelemetryPacket, enqueuePacket } from "@/lib/sync/outbound";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WilliamsSync placeholder endpoint. Given an attempt the caller owns, builds
 * the telemetry packet and hands it to the outbound transport (logged unless
 * WILLIAMS_SYNC_URL is set). Returns the packet so callers/tests can inspect
 * what WilliamsHub will receive. Full sync is intentionally not wired here.
 */
const Body = z.object({ attemptId: z.string().min(1) });

export async function POST(req: Request) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const attempt = await findAttemptForUser(parsed.data.attemptId, auth.user.id);
  if (!attempt) return NextResponse.json({ error: "not found" }, { status: 404 });

  const telemetry = await listTelemetryForAttempt(attempt.id);
  const packet = buildPodTelemetryPacket(attempt.id, auth.user.id, telemetry);
  const result = await enqueuePacket(packet);

  return NextResponse.json({
    ok: true,
    transport: result.ok ? result.transport : "error",
    mistakeGroups: packet.mistakes.length,
    repairRecommendations: packet.repairRecommendations.length,
    packet,
  });
}
