// Minimal .env loader for scripts run outside next/turbopack.
// Next.js auto-loads .env.local in app code; this only matters for `tsx scripts/...`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const candidates = [".env.local", ".env"];

for (const file of candidates) {
  try {
    const raw = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // file missing, skip
  }
}

export {};
