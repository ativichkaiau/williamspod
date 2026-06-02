import { cookies } from "next/headers";

const COOKIE_NAME = "williamspod_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

function getSecret(): string {
  const s = process.env.WILLIAMSPOD_AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "WILLIAMSPOD_AUTH_SECRET is missing or too short (need >= 16 chars).",
    );
  }
  return s;
}

function getPassword(): string {
  const p = process.env.WILLIAMSPOD_PASSWORD;
  if (!p) throw new Error("WILLIAMSPOD_PASSWORD is missing.");
  return p;
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
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toHex(sig);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyPassword(input: string): Promise<boolean> {
  return constantTimeEqual(input, getPassword());
}

export async function issueSessionToken(): Promise<string> {
  const issuedAt = Date.now();
  const payload = `v1.${issuedAt}`;
  const sig = await hmac(getSecret(), payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [, issuedAtStr, sig] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;
  const ageMs = Date.now() - issuedAt;
  if (ageMs < 0 || ageMs > SESSION_MAX_AGE_SECONDS * 1000) return false;
  const expected = await hmac(getSecret(), `v1.${issuedAtStr}`);
  return constantTimeEqual(sig, expected);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
