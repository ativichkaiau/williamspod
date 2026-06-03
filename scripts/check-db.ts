import "../lib/env";
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  console.log("connecting to:", url);

  const client = createClient({ url, authToken });
  try {
    const r = await client.execute(
      "select name from sqlite_master where type='table' order by name",
    );
    const names = r.rows.map((row) => String(row.name));
    if (names.length === 0) {
      console.log("tables: (none — database is empty)");
    } else {
      console.log("tables:");
      for (const n of names) console.log("  -", n);
    }
  } catch (err) {
    console.error("query failed:", (err as Error).message);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

main();
