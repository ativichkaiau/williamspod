import "../lib/env";
import { db } from "../lib/db";
import { lectures, questions, users } from "../lib/db/schema";
import { uid } from "../lib/utils";
import { createAttempt, submitAttempt } from "../lib/attempts";
import { loadDebrief } from "../lib/debrief";
import { listTelemetryForAttempt } from "../lib/telemetry/store";
import { buildPodTelemetryPacket, enqueuePacket } from "../lib/sync/outbound";

/**
 * End-to-end integration test for telemetry recording + classification +
 * the WilliamsSync packet. Run against a THROWAWAY local DB so prod is
 * untouched:
 *
 *   DATABASE_URL=file:/tmp/wp-teltest.db npm run db:migrate
 *   DATABASE_URL=file:/tmp/wp-teltest.db npx tsx scripts/telemetry-run-test.ts
 */
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) {
    throw new Error(
      `refusing to run against non-file DB (${url}). Use DATABASE_URL=file:/tmp/wp-teltest.db`,
    );
  }

  const userId = uid("usr");
  await db.insert(users).values({
    id: userId,
    name: "Telemetry Runner",
    nameLower: "telemetry runner " + userId,
    role: "member",
    passhash: "pbkdf2$1$00$00",
  });
  const lectureId = uid("lec");
  await db.insert(lectures).values({
    id: lectureId,
    name: "Cardio Lecture",
    slug: "cardio-" + uid(),
    subject: "HEN-2",
  });

  // Q1: easy recall (fast + correct). Q2: hard integration (slow + wrong).
  const qRecall = uid("q");
  const qInteg = uid("q");
  await db.insert(questions).values([
    {
      id: qRecall,
      lectureId,
      stem: "Which murmur signals acute aortic regurgitation?",
      choices: ["Early diastolic", "Pansystolic", "Mid-systolic", "Continuous"],
      correctIndex: 0,
      explanation: "Acute AR → early diastolic murmur.",
      topic: "valves",
      difficulty: 1,
    },
    {
      id: qInteg,
      lectureId,
      stem: "Dissection into the root plus tamponade — first priority?",
      choices: ["Pericardiocentesis then surgery", "Beta-blockade only", "Thrombolysis", "Discharge"],
      correctIndex: 0,
      explanation: "Root + tamponade needs surgical control.",
      topic: "emergencies",
      difficulty: 3,
    },
  ]);
  console.log("seeded 1 lecture + 2 questions");

  const setup = await createAttempt({
    userId,
    mode: "custom",
    lectureIds: [lectureId],
    durationMs: 600_000,
    shuffleQuestions: false,
    shuffleChoices: false,
    useVariants: false,
  });
  assert(setup.questions.length === 2, "attempt has both questions");

  // Adaptive timing budgets should differ: recall << integration.
  const recallItem = setup.questions.find((q) => q.id === qRecall)!;
  const integItem = setup.questions.find((q) => q.id === qInteg)!;
  assert(
    (recallItem.recommendedSec ?? 0) < (integItem.recommendedSec ?? 0),
    `recall budget (${recallItem.recommendedSec}s) < integration budget (${integItem.recommendedSec}s)`,
  );

  const recallCorrect = recallItem.displayChoices.findIndex((c) => c === "Early diastolic");
  const integWrong = integItem.displayChoices.findIndex((c) => c === "Beta-blockade only");

  const recallBudgetMs = (recallItem.recommendedSec ?? 25) * 1000;
  const integBudgetMs = (integItem.recommendedSec ?? 150) * 1000;

  await submitAttempt({
    attemptId: setup.attempt.id,
    picks: { [qRecall]: recallCorrect, [qInteg]: integWrong },
    marked: {},
    timeUsedMs: 200_000,
    telemetry: {
      // Fast + correct → fluent.
      [qRecall]: {
        timeTakenMs: Math.round(recallBudgetMs * 0.3),
        clickCount: 1,
        answerChangeCount: 0,
        revisitCount: 0,
        confidence: 4,
      },
      // Slow + wrong on an integration item → integration_error, high priority.
      [qInteg]: {
        timeTakenMs: Math.round(integBudgetMs * 2),
        clickCount: 4,
        answerChangeCount: 1,
        revisitCount: 2,
        confidence: 2,
      },
    },
  });

  // ---- Stored telemetry ----
  const rows = await listTelemetryForAttempt(setup.attempt.id);
  assert(rows.length === 2, "two telemetry rows persisted");
  const recallRow = rows.find((r) => r.questionId === qRecall)!;
  const integRow = rows.find((r) => r.questionId === qInteg)!;
  assert(recallRow.timingCategory === "fast_correct", "recall row → fast_correct");
  assert(integRow.timingCategory === "slow_wrong", "integration row → slow_wrong");
  assert(integRow.errorType === "integration_error", "integration miss → integration_error");
  assert(integRow.revisitCount === 2, "revisit count persisted");

  // ---- Debrief summary ----
  const debrief = await loadDebrief(setup.attempt.id, userId);
  assert(!!debrief, "debrief loads");
  assert(!!debrief!.telemetry, "debrief telemetry summary is populated");
  assert(debrief!.telemetry!.total === 2, "summary counts both questions");
  assert(
    (debrief!.telemetry!.byTimingCategory.fast_correct ?? 0) === 1 &&
      (debrief!.telemetry!.byTimingCategory.slow_wrong ?? 0) === 1,
    "summary buckets fast_correct + slow_wrong",
  );
  const wrong = debrief!.wrongAnswers.find((w) => w.questionId === qInteg);
  assert(!!wrong, "the integration miss is in wrong answers");
  assert(wrong!.timingCategory === "slow_wrong", "wrong-answer row carries timing category");
  assert(wrong!.errorType === "integration_error", "wrong-answer row carries error type");

  // ---- WilliamsSync packet ----
  const packet = buildPodTelemetryPacket(setup.attempt.id, userId, rows);
  assert(packet.version === "1.0" && packet.source === "williamspod", "packet header");
  assert(packet.performance.length === 2, "packet has 2 performance summaries");
  assert(
    packet.mistakes.length === 1 && packet.mistakes[0].errorType === "integration_error",
    "packet rolls up the integration mistake",
  );
  assert(
    packet.repairRecommendations[0]?.priority === "high",
    "integration_error → high-priority repair",
  );
  assert(
    packet.repairRecommendations[0]?.subject === "HEN-2",
    "repair recommendation carries subject",
  );

  // enqueuePacket must not throw with no WILLIAMS_SYNC_URL set (logs only).
  const enq = await enqueuePacket(packet);
  assert(enq.ok === true, `enqueue ok (transport=${enq.ok ? enq.transport : "n/a"})`);

  console.log("\nALL CHECKS PASSED ✅");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n" + err.message);
  process.exit(1);
});
