import "../lib/env";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";

async function main() {
  console.log("connecting to:", process.env.DATABASE_URL);
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      passhash: users.passhash,
      archivedAt: users.archivedAt,
      createdAt: users.createdAt,
    })
    .from(users);

  if (rows.length === 0) {
    console.log("\n(no users found — run `npm run setup:admin` next)");
    process.exit(0);
  }

  console.log(`\n${rows.length} user(s):`);
  for (const u of rows) {
    console.log("  -", {
      name: u.name,
      role: u.role,
      hashOk: u.passhash.startsWith("pbkdf2$"),
      archived: !!u.archivedAt,
      id: u.id,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
