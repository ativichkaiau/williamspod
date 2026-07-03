import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "williamspod_session";
const COOKIE_VERSION = "v2";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/check-invite",
  // WilliamsSync export is token-gated inside the route (not session-gated), so
  // it must bypass the cookie middleware to be reachable cross-origin.
  "/api/sync/export",
];

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

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [ver, userId, issuedAtStr, sig] = parts;
  if (ver !== COOKIE_VERSION) return false;
  if (!userId) return false;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;
  const ageMs = Date.now() - issuedAt;
  if (ageMs < 0 || ageMs > SESSION_MAX_AGE_MS) return false;
  const secret = process.env.WILLIAMSPOD_AUTH_SECRET;
  if (!secret) return false;
  const expected = await hmac(secret, `${COOKIE_VERSION}.${userId}.${issuedAtStr}`);
  return constantTimeEqual(sig, expected);
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (await isValidSession(token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
