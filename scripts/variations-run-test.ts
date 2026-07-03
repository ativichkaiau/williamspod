import "../lib/env";
import { db } from "../lib/db";
import { lectures, questions, users } from "../lib/db/schema";
import { uid } from "../lib/utils";
import { generateVariants } from "../lib/variations/service";
import { saveVariants } from "../lib/variations/store";
import {
  createAttempt,
  loadAttemptForRuntime,
  submitAttempt,
} from "../lib/attempts";
import { loadDebrief } from "../lib/debrief";

/**
 * End-to-end integration test for variant-backed runs. Run against a THROWAWAY
 * local DB so prod is untouched:
 *
 *   DATABASE_URL=file:/tmp/wp-vartest.db npm run db:migrate
 *   DATABASE_URL=file:/tmp/wp-vartest.db npx tsx scripts/variations-run-test.ts
 */
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) {
    throw new Error(
      `refusing to run against non-file DB (${url}). Use DATABASE_URL=file:/tmp/wp-vartest.db`,
    );
  }

  const userId = uid("usr");
  await db.insert(users).values({
    id: userId,
    name: "Test Runner",
    nameLower: "test runner " + userId,
    role: "member",
    passhash: "pbkdf2$1$00$00",
  });
  const lectureId = uid("lec");
  await db.insert(lectures).values({
    id: lectureId,
    name: "Test Lecture",
    slug: "test-lecture-" + uid(),
    subject: "TEST",
  });
  const qId = uid("q");
  await db.insert(questions).values({
    id: qId,
    lectureId,
    stem: "Base: which finding is most expected in aortic dissection?",
    choices: ["Early diastolic murmur", "Pansystolic murmur", "S3 gallop", "Friction rub"],
    correctIndex: 0,
    explanation: "Root involvement causes acute AR (early diastolic murmur).",
    topic: "aortic dissection",
    difficulty: 3,
  });
  console.log("seeded 1 lecture + 1 question");

  // Generate + persist variants (placeholder provider — offline).
  const base = {
    id: qId,
    lectureId,
    stem: "Base: which finding is most expected in aortic dissection?",
    choices: ["Early diastolic murmur", "Pansystolic murmur", "S3 gallop", "Friction rub"],
    correctIndex: 0,
    explanation: "Root involvement causes acute AR (early diastolic murmur).",
    topic: "aortic dissection",
    difficulty: 3,
  };
  const gen = await generateVariants(base, { angles: ["mechanism", "trap"] });
  const saved = await saveVariants(qId, gen, userId);
  assert(saved.length >= 1, `persisted ${saved.length} variants`);

  // Create an attempt WITH variants. No shuffle so we can reason about indices.
  console.log("\ncreating attempt with useVariants=true…");
  const setup = await createAttempt({
    userId,
    mode: "custom",
    lectureIds: [lectureId],
    durationMs: 600_000,
    shuffleQuestions: false,
    shuffleChoices: false,
    useVariants: true,
    seed: 12345,
  });
  const item = setup.questions[0];
  assert(!!item.variantId, "the served item is a substituted variant");
  assert(
    item.stem !== base.stem,
    "the served stem differs from the base stem (variant framing)",
  );

  // Runtime load returns the same variant stem.
  const runtime = await loadAttemptForRuntime(setup.attempt.id, userId);
  assert(!!runtime, "runtime loads the attempt");
  assert(
    runtime!.questions[0].stem === item.stem,
    "runtime serves the variant stem",
  );

  // The correct choice text is preserved from the concept ("Early diastolic murmur").
  const correctDisplayIdx = item.displayChoices.findIndex(
    (c) => c === "Early diastolic murmur",
  );
  assert(correctDisplayIdx >= 0, "correct concept answer is present among choices");

  // Submit the CORRECT pick → score 1/1.
  const resCorrect = await submitAttempt({
    attemptId: setup.attempt.id,
    picks: { [qId]: correctDisplayIdx },
    marked: {},
    timeUsedMs: 1000,
  });
  assert(
    resCorrect.scoreCorrect === 1 && resCorrect.scoreTotal === 1,
    `graded against the variant's correct answer (${resCorrect.scoreCorrect}/${resCorrect.scoreTotal})`,
  );

  // Now a second attempt, answer WRONG, and confirm the debrief flags the variant.
  const setup2 = await createAttempt({
    userId,
    mode: "custom",
    lectureIds: [lectureId],
    durationMs: 600_000,
    shuffleQuestions: false,
    shuffleChoices: false,
    useVariants: true,
    seed: 999,
  });
  const wrongIdx = setup2.questions[0].displayChoices.findIndex(
    (c) => c !== "Early diastolic murmur",
  );
  await submitAttempt({
    attemptId: setup2.attempt.id,
    picks: { [qId]: wrongIdx },
    marked: {},
    timeUsedMs: 1000,
  });
  const debrief = await loadDebrief(setup2.attempt.id, userId);
  assert(!!debrief, "debrief loads");
  assert(debrief!.wrongAnswers.length === 1, "one wrong answer recorded");
  assert(debrief!.wrongAnswers[0].isVariant === true, "debrief marks it as a variant");
  assert(
    debrief!.bySector[0]?.name === "Test Lecture",
    "sector telemetry stays on the base lecture",
  );

  console.log("\nALL CHECKS PASSED ✅");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n" + err.message);
  process.exit(1);
});
