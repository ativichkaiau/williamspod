import "../lib/env";
import { computeTiming, inferQuestionType } from "../lib/timing/service";
import { classifyAttempt } from "../lib/telemetry/classify";
import { buildPodTelemetryPacket } from "../lib/sync/outbound";
import type { TelemetryRecord } from "../lib/telemetry/types";

/**
 * Pure unit checks for the WilliamsPod upgrade (no DB, no key):
 *   npx tsx scripts/telemetry-test.ts
 */
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

function main() {
  console.log("1) Adaptive timing budgets");
  const recall = computeTiming({ questionType: "recall", difficulty: 1 });
  const integ = computeTiming({ questionType: "integration", difficulty: 3 });
  assert(recall.recommendedSeconds < integ.recommendedSeconds, "recall < integration");
  assert(recall.recommendedSeconds >= 8 && recall.recommendedSeconds <= 40, `recall budget sane (${recall.recommendedSeconds}s)`);
  const pressure = computeTiming({ questionType: "clinical_vignette", mode: "pressure" });
  const recovery = computeTiming({ questionType: "clinical_vignette", mode: "recovery" });
  assert(pressure.recommendedSeconds < recovery.recommendedSeconds, "pressure mode < recovery mode");
  const lowConf = computeTiming({ questionType: "mechanism", profile: { confidence: 1 } });
  const highConf = computeTiming({ questionType: "mechanism", profile: { confidence: 5 } });
  assert(lowConf.recommendedSeconds > highConf.recommendedSeconds, "low confidence earns more time");
  assert(inferQuestionType(1, null) === "recall", "difficulty 1 → recall type");
  assert(inferQuestionType(2, "trap") === "trap", "explicit angle wins");

  console.log("\n2) Error classification");
  const expectedMs = computeTiming({ questionType: "clinical_vignette", difficulty: 2 }).recommendedMs;
  const fastWrong = classifyAttempt({ isCorrect: false, answered: true, timeTakenMs: expectedMs * 0.3, expectedMs, questionType: "clinical_vignette", metrics: { clickCount: 1, answerChangeCount: 0, revisitCount: 0, confidence: null } });
  assert(fastWrong.timingCategory === "fast_wrong", "fast wrong → fast_wrong");
  assert(fastWrong.errorType === "trap_error", "fast wrong → trap/impulsive error");
  const slowWrong = classifyAttempt({ isCorrect: false, answered: true, timeTakenMs: expectedMs * 2, expectedMs, questionType: "mechanism", metrics: { clickCount: 1, answerChangeCount: 0, revisitCount: 0, confidence: null } });
  assert(slowWrong.timingCategory === "slow_wrong", "slow wrong → slow_wrong");
  assert(slowWrong.errorType === "mechanism_error", "slow wrong on mechanism → mechanism_error");
  const slowCorrect = classifyAttempt({ isCorrect: true, answered: true, timeTakenMs: expectedMs * 2, expectedMs, questionType: "recall", metrics: { clickCount: 1, answerChangeCount: 0, revisitCount: 0, confidence: null } });
  assert(slowCorrect.timingCategory === "slow_correct" && slowCorrect.signals.includes("not_fluent"), "slow correct → not fluent");
  const overthink = classifyAttempt({ isCorrect: false, answered: true, timeTakenMs: expectedMs * 2, expectedMs, questionType: "clinical_vignette", metrics: { clickCount: 6, answerChangeCount: 3, revisitCount: 2, confidence: null } });
  assert(overthink.errorType === "overthinking_error", "slow + many changes → overthinking_error");
  const confErr = classifyAttempt({ isCorrect: false, answered: true, timeTakenMs: expectedMs, expectedMs, questionType: "diagnosis", metrics: { clickCount: 1, answerChangeCount: 0, revisitCount: 0, confidence: 5 } });
  assert(confErr.errorType === "confidence_error", "wrong at high confidence → confidence_error");

  console.log("\n3) WilliamsSync packet");
  const tel: TelemetryRecord[] = [
    { id: "t1", attemptId: "a", userId: "u", questionId: "q1", originalQuestionId: "q1", variantId: "v1", lectureId: "lecA", subject: "HEN-2", questionType: "mechanism", selectedIndex: 2, correctIndex: 0, isCorrect: false, timeTakenMs: 100000, clickCount: 2, answerChangeCount: 1, revisitCount: 1, confidence: null, timingCategory: "slow_wrong", errorType: "mechanism_error", trapType: "none", attemptedAt: new Date().toISOString() },
    { id: "t2", attemptId: "a", userId: "u", questionId: "q2", originalQuestionId: null, variantId: null, lectureId: "lecA", subject: "HEN-2", questionType: "recall", selectedIndex: 0, correctIndex: 0, isCorrect: true, timeTakenMs: 15000, clickCount: 1, answerChangeCount: 0, revisitCount: 0, confidence: null, timingCategory: "fast_correct", errorType: null, trapType: "none", attemptedAt: new Date().toISOString() },
  ];
  const packet = buildPodTelemetryPacket("a", "u", tel);
  assert(packet.version === "1.0" && packet.source === "williamspod", "packet header correct");
  assert(packet.performance.length === 2, "performance summaries present");
  assert(packet.mistakes.length === 1 && packet.mistakes[0].errorType === "mechanism_error", "mistake rollup by error type");
  assert(packet.repairRecommendations.length === 1, "one repair recommendation");
  assert(packet.repairRecommendations[0].priority === "high", "mechanism error → high priority");
  assert(packet.repairRecommendations[0].sourceQuestionId === "q1", "repair traces to original question");

  console.log("\nALL CHECKS PASSED ✅");
}

try {
  main();
  process.exit(0);
} catch (e) {
  console.error("\n" + (e as Error).message);
  process.exit(1);
}
