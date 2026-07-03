import type { TelemetryRecord } from "@/lib/telemetry/types";
import {
  SYNC_PACKET_VERSION,
  type MistakeClassification,
  type PodTelemetryPacket,
  type QuestionPerformanceSummary,
  type RepairRecommendation,
} from "./types";

/**
 * WilliamsSync outbound — PREPARED, not yet transmitting.
 *
 * `buildPodTelemetryPacket` turns a run's telemetry into the packet shape
 * WilliamsHub expects. `enqueuePacket` is the seam where real transport
 * (HTTP POST to a hub endpoint / Supabase insert / queue) will live. Today it
 * either logs (default) or POSTs to WILLIAMS_SYNC_URL when configured — never
 * throwing into the request path.
 */

const RECOMMENDED_ACTION: Record<string, string> = {
  recall_error: "Re-drill the core fact (quick_review) then re-test.",
  mechanism_error: "Review the cause→effect pathway (mechanism mode).",
  frame_error: "Re-read the clinical frame; practice vignette parsing.",
  trap_error: "Study the distractor set; contrast specific vs nonspecific signs.",
  overthinking_error: "Time-box this type; commit to first sound answer.",
  timing_error: "Run a sprint set on this type to build speed.",
  confidence_error: "Confidence miscalibrated — review before re-testing.",
  integration_error: "Study the cross-system link (integration mode).",
};

function priorityFor(errorType: string): RepairRecommendation["priority"] {
  if (errorType === "integration_error" || errorType === "mechanism_error")
    return "high";
  if (errorType === "trap_error" || errorType === "frame_error") return "medium";
  return "low";
}

export function buildPodTelemetryPacket(
  attemptId: string,
  userId: string | null,
  telemetry: TelemetryRecord[],
): PodTelemetryPacket {
  const performance: QuestionPerformanceSummary[] = telemetry.map((t) => ({
    questionId: t.questionId,
    originalQuestionId: t.originalQuestionId,
    variantId: t.variantId,
    lectureId: t.lectureId,
    subject: t.subject,
    questionType: t.questionType,
    isCorrect: t.isCorrect,
    timingCategory: t.timingCategory,
    errorType: t.errorType,
    timeTakenMs: t.timeTakenMs,
  }));

  // Roll up mistakes by error type + lecture.
  const byError = new Map<string, Map<string, number>>();
  for (const t of telemetry) {
    if (!t.errorType) continue;
    const lecKey = t.lectureId ?? "unknown";
    const lecMap = byError.get(t.errorType) ?? new Map<string, number>();
    lecMap.set(lecKey, (lecMap.get(lecKey) ?? 0) + 1);
    byError.set(t.errorType, lecMap);
  }
  const mistakes: MistakeClassification[] = Array.from(byError.entries()).map(
    ([errorType, lecMap]) => ({
      errorType,
      count: Array.from(lecMap.values()).reduce((s, n) => s + n, 0),
      lectures: Array.from(lecMap.entries())
        .map(([lectureId, count]) => ({
          lectureId: lectureId === "unknown" ? null : lectureId,
          count,
        }))
        .sort((a, b) => b.count - a.count),
    }),
  );

  // One repair recommendation per wrong question (deduped by lecture+error).
  const seen = new Set<string>();
  const repairRecommendations: RepairRecommendation[] = [];
  for (const t of telemetry) {
    if (t.isCorrect || !t.errorType) continue;
    const key = `${t.lectureId}:${t.errorType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    repairRecommendations.push({
      lectureId: t.lectureId,
      subject: t.subject,
      errorType: t.errorType,
      priority: priorityFor(t.errorType),
      recommendedAction:
        RECOMMENDED_ACTION[t.errorType] ?? "Review this concept and re-test.",
      sourceQuestionId: t.originalQuestionId ?? t.questionId,
    });
  }

  return {
    version: SYNC_PACKET_VERSION,
    source: "williamspod",
    userId,
    attemptId,
    createdAt: new Date().toISOString(),
    telemetry,
    mistakes,
    performance,
    repairRecommendations,
  };
}

export type EnqueueResult =
  | { ok: true; transport: "logged" | "http"; status?: number }
  | { ok: false; error: string };

/**
 * The transport seam. Placeholder: logs by default; POSTs to WILLIAMS_SYNC_URL
 * with WILLIAMS_SYNC_TOKEN when configured. Never throws — sync failures must
 * not break a run submission.
 */
export async function enqueuePacket(
  packet: PodTelemetryPacket,
): Promise<EnqueueResult> {
  const url = process.env.WILLIAMS_SYNC_URL;
  if (!url) {
    // Prepared, not wired: record intent without failing the request.
    console.info(
      `[williams-sync] packet ready (not sent — WILLIAMS_SYNC_URL unset): attempt=${packet.attemptId} mistakes=${packet.mistakes.length} recs=${packet.repairRecommendations.length}`,
    );
    return { ok: true, transport: "logged" };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.WILLIAMS_SYNC_TOKEN
          ? { authorization: `Bearer ${process.env.WILLIAMS_SYNC_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(packet),
      keepalive: true,
    });
    return { ok: true, transport: "http", status: res.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
