import "../lib/env";
import { eq, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { lectures } from "../lib/db/schema";

/**
 * Assigns a `subject` to each existing lecture based on its name.
 *
 *   - HNS-2 lectures use "LT##" prefix (LT01, LT02, ..., LT19)
 *   - HEN-2 lectures use "LT#" or "LT##" prefix but cover endocrine topics
 *     (Pituitary, Adrenal, Thyroid, DM, Cushing, ...)
 *
 * Strategy: name-based heuristic. Idempotent — only sets subject when NULL.
 */

const HEN2_KEYWORDS = [
  "Pituitary",
  "Hypothalamus",
  "Adrenal",
  "MEN",
  "Cushing",
  "Corticosteroid",
  "Thyroid",
  "Parathyroid",
  "DM",
  "Diabetes",
  "T1-T2",
];

function inferSubject(name: string): string | null {
  if (HEN2_KEYWORDS.some((k) => name.includes(k))) return "HEN-2";
  if (/^LT\d{2}\b/.test(name)) return "HNS-2";
  return null;
}

async function main() {
  const rows = await db.select().from(lectures).where(isNull(lectures.subject));
  console.log(`${rows.length} lectures need a subject`);

  const counts: Record<string, number> = {};
  for (const r of rows) {
    const subj = inferSubject(r.name);
    if (!subj) {
      console.log(`  - skipping (no match): ${r.name}`);
      continue;
    }
    await db
      .update(lectures)
      .set({ subject: subj, updatedAt: new Date() })
      .where(eq(lectures.id, r.id));
    counts[subj] = (counts[subj] ?? 0) + 1;
  }

  console.log("\nUpdated:");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v}`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
