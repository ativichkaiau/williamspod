import "../lib/env";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { lectures } from "../lib/db/schema";

// Usage:
//   DATABASE_URL=... DATABASE_AUTH_TOKEN=... \
//   npx tsx scripts/delete-lecture.ts "HEN-2 Mock"
//
// Hard-deletes any lecture whose name matches exactly (cascades to questions).

async function main() {
  const name = process.argv[2];
  if (!name) {
    console.error("usage: delete-lecture.ts <exact-lecture-name>");
    process.exit(1);
  }
  const rows = await db
    .select()
    .from(lectures)
    .where(eq(lectures.name, name));
  if (rows.length === 0) {
    console.log(`no lectures named "${name}"`);
    return;
  }
  for (const r of rows) {
    await db.delete(lectures).where(eq(lectures.id, r.id));
    console.log(`deleted ${r.id} (${r.slug})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
