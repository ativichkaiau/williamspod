/**
 * WilliamsSync export token — a long-lived, per-user token that lets WilliamsHub
 * PULL this user's telemetry cross-origin (the session cookie can't cross origins
 * / sites). Signed with the existing WILLIAMSPOD_AUTH_SECRET, so no new env var is
 * needed. Rotate by rotating the secret. Format: `exp1.<userId>.<hmac>`.
 */

const EXPORT_VERSION = "exp1";

function getSecret(): string {
  const s = process.env.WILLIAMSPOD_AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("WILLIAMSPOD_AUTH_SECRET is missing or too short (need >= 16 chars).");
  }
  return s;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function issueExportToken(userId: string): Promise<string> {
  const payload = `${EXPORT_VERSION}.${userId}`;
  return `${payload}.${await hmac(getSecret(), payload)}`;
}

/** Returns the userId if the token is valid, else null. */
export async function verifyExportToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [ver, userId, sig] = parts;
  if (ver !== EXPORT_VERSION || !userId) return null;
  const expected = await hmac(getSecret(), `${ver}.${userId}`);
  return constantTimeEqual(sig, expected) ? userId : null;
}
