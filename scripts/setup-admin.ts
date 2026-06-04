import "../lib/env";
import { eq, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { attempts, users } from "../lib/db/schema";
import { createUser, findUserByName, hashPassword } from "../lib/users";

/**
 * Bootstrap the admin user and backfill legacy single-user attempts.
 *
 * Reads env:
 *   WILLIAMSPOD_ADMIN_NAME       (default "admin")
 *   WILLIAMSPOD_ADMIN_PASSWORD   (falls back to WILLIAMSPOD_PASSWORD)
 *
 * Idempotent: re-running is safe.
 */
async function main() {
  const name = (process.env.WILLIAMSPOD_ADMIN_NAME ?? "admin").trim();
  const password =
    process.env.WILLIAMSPOD_ADMIN_PASSWORD ?? process.env.WILLIAMSPOD_PASSWORD;

  if (!password || password.length < 6) {
    console.error(
      "Set WILLIAMSPOD_ADMIN_PASSWORD (>= 6 chars) before running setup-admin.",
    );
    process.exit(1);
  }

  console.log(`looking up admin "${name}"…`);
  let admin = await findUserByName(name);

  if (!admin) {
    console.log(`creating admin "${name}"…`);
    admin = await createUser({ name, password, role: "admin" });
    console.log(`  created user id ${admin.id}`);
  } else {
    // Make sure the role is admin (in case it was demoted somehow).
    if (admin.role !== "admin") {
      console.log(`promoting "${name}" to admin…`);
      await db
        .update(users)
        .set({ role: "admin", archivedAt: null })
        .where(eq(users.id, admin.id));
    }
    // Update passhash so re-running with new password rotates it.
    console.log(`rotating passhash for "${name}"…`);
    const passhash = await hashPassword(password);
    await db
      .update(users)
      .set({ passhash })
      .where(eq(users.id, admin.id));
  }

  // Backfill legacy attempts (NULL userId).
  const orphaned = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(isNull(attempts.userId));

  if (orphaned.length > 0) {
    console.log(
      `backfilling ${orphaned.length} legacy attempts → user ${admin.id}…`,
    );
    await db
      .update(attempts)
      .set({ userId: admin.id })
      .where(isNull(attempts.userId));
  } else {
    console.log("no legacy attempts to backfill");
  }

  console.log("done.");
  console.log(
    `\nLog in at /login with name="${admin.name}" and your admin password.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
