import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findUserById, touchLastSeen } from "./users";
import type { User } from "./db/schema";

const COOKIE_NAME = "williamspod_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const COOKIE_VERSION = "v2";

function getSecret(): string {
  const s = process.env.WILLIAMSPOD_AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "WILLIAMSPOD_AUTH_SECRET is missing or too short (need >= 16 chars).",
    );
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
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toHex(sig);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export type SessionInfo = { userId: string; issuedAtMs: number };

export async function issueSessionToken(userId: string): Promise<string> {
  const issuedAt = Date.now();
  const payload = `${COOKIE_VERSION}.${userId}.${issuedAt}`;
  const sig = await hmac(getSecret(), payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionInfo | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [ver, userId, issuedAtStr, sig] = parts;
  if (ver !== COOKIE_VERSION) return null;
  if (!userId) return null;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return null;
  const ageMs = Date.now() - issuedAt;
  if (ageMs < 0 || ageMs > SESSION_MAX_AGE_SECONDS * 1000) return null;
  const expected = await hmac(
    getSecret(),
    `${COOKIE_VERSION}.${userId}.${issuedAtStr}`,
  );
  if (!constantTimeEqual(sig, expected)) return null;
  return { userId, issuedAtMs: issuedAt };
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

export async function getSession(): Promise<SessionInfo | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user || user.archivedAt) return null;
  return user;
}

/**
 * Use in server pages / route handlers that absolutely need a user.
 * Throws — the middleware should have already redirected unauth requests,
 * so reaching this with no user is a bug, not a normal case.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("not authenticated");
  // Best-effort last-seen update.
  void touchLastSeen(user.id);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("admin only");
  return user;
}

// ---------------------------------------------------------------------------
// API-route-friendly variants. These return a NextResponse on failure instead
// of throwing, so route handlers can early-return without try/catch.
// ---------------------------------------------------------------------------

export type ApiAuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

export async function apiAuth(opts?: {
  adminOnly?: boolean;
}): Promise<ApiAuthResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  if (opts?.adminOnly && user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "admin only" }, { status: 403 }),
    };
  }
  // Best-effort last-seen update.
  void touchLastSeen(user.id);
  return { ok: true, user };
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
