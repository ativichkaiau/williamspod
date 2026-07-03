import type { TelemetryRecord } from "@/lib/telemetry/types";

/**
 * WilliamsSync — the bridge that will forward WilliamsPod telemetry to
 * WilliamsHub. This file defines the packet shape only; the transport is a
 * prepared placeholder (see outbound.ts). WilliamsHub will consume these to
 * build repair queues and integration-aware module pages.
 */

export const SYNC_PACKET_VERSION = "1.0" as const;

/** A per-question performance summary a hub can turn into repair items. */
export interface QuestionPerformanceSummary {
  questionId: string;
  originalQuestionId: string | null;
  variantId: string | null;
  lectureId: string | null;
  subject: string | null;
  questionType: string;
  isCorrect: boolean;
  timingCategory: string | null;
  errorType: string | null;
  timeTakenMs: number;
}

/** Mistake classification rollup for a run (what WilliamsHub repairs against). */
export interface MistakeClassification {
  errorType: string;
  count: number;
  /** Lectures where this error clustered, worst first. */
  lectures: { lectureId: string | null; count: number }[];
}

export interface PodTelemetryPacket {
  version: typeof SYNC_PACKET_VERSION;
  source: "williamspod";
  userId: string | null;
  attemptId: string;
  createdAt: string; // ISO
  /** Raw per-question telemetry. */
  telemetry: TelemetryRecord[];
  /** Rolled-up mistake classifications. */
  mistakes: MistakeClassification[];
  /** Compact per-question performance summaries. */
  performance: QuestionPerformanceSummary[];
  /** Repair recommendations WilliamsHub can enqueue (advisory). */
  repairRecommendations: RepairRecommendation[];
}

/** A recommendation the hub can turn into a RepairQueueItem. */
export interface RepairRecommendation {
  lectureId: string | null;
  subject: string | null;
  errorType: string;
  priority: "low" | "medium" | "high";
  recommendedAction: string;
  sourceQuestionId: string;
}
