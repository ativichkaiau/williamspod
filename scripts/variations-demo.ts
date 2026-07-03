import "../lib/env";
import { generateVariants } from "../lib/variations/service";
import { parseAiVariationResponse } from "../lib/variations/types";
import { EXAMPLE_BASE_QUESTION, EXAMPLE_VARIATIONS } from "../lib/variations/examples";

/**
 * Offline sanity check for the variation pipeline — no DB, no API key required.
 *
 *   npx tsx scripts/variations-demo.ts
 *
 * 1. Validates the hand-written example set against the strict JSON contract.
 * 2. Runs the configured provider (placeholder by default) on the example base
 *    question and prints the generated variants.
 */
async function main() {
  console.log("1) Validating the reference example against the strict schema…");
  const check = parseAiVariationResponse(EXAMPLE_VARIATIONS);
  if (!check.ok) {
    console.error("   ✗ example invalid:", check.error);
    process.exit(1);
  }
  console.log(
    `   ✓ ${check.data.variants.length} example variants valid — objective: ${check.data.learningObjective}`,
  );

  console.log("\n2) Generating from the base question via the configured provider…");
  const result = await generateVariants(EXAMPLE_BASE_QUESTION);
  console.log(`   provider: ${result.provider}  model: ${result.model ?? "—"}`);
  console.log(`   objective: ${result.data.learningObjective}\n`);
  for (const v of result.data.variants) {
    console.log(`   [${v.angle} · ${v.difficulty}] ${v.stem}`);
    v.choices.forEach((c, i) =>
      console.log(
        `      ${String.fromCharCode(65 + i)}. ${c}${i === v.correctIndex ? "  ✓" : ""}`,
      ),
    );
    console.log("");
  }
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
