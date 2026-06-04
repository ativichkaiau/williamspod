import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, invites, type User, type NewUser } from "./db/schema";
import { uid } from "./utils";

const PBKDF2_ITERATIONS = 100_000;

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256, // 32 bytes
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 6) throw new Error("password must be at least 6 characters");
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2(plain, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = Number(parts[1]);
    if (!Number.isFinite(iterations) || iterations < 10_000) return false;
    const salt = fromHex(parts[2]);
    const expected = fromHex(parts[3]);
    const actual = await pbkdf2(plain, salt, iterations);
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Names + lookups
// ---------------------------------------------------------------------------

export function normalizeName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return false;
  // Allow letters, numbers, spaces, hyphens, underscores, dots, apostrophes.
  return /^[\p{L}\p{N} \-_.''']+$/u.test(trimmed);
}

export async function findUserByName(name: string): Promise<User | null> {
  const norm = normalizeName(name);
  if (!norm) return null;
  const rows = await db.select().from(users).where(eq(users.nameLower, norm));
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id));
  return rows[0] ?? null;
}

export async function touchLastSeen(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ lastSeenAt: new Date() })
    .where(eq(users.id, userId));
}

// ---------------------------------------------------------------------------
// Create / authenticate
// ---------------------------------------------------------------------------

export async function createUser(opts: {
  name: string;
  password: string;
  role?: "admin" | "member";
}): Promise<User> {
  const display = opts.name.trim();
  if (!isValidDisplayName(display)) {
    throw new Error("invalid display name");
  }
  const nameLower = normalizeName(display);
  const existing = await findUserByName(nameLower);
  if (existing) throw new Error("that name is taken");
  const passhash = await hashPassword(opts.password);
  const row: NewUser = {
    id: uid("usr"),
    name: display,
    nameLower,
    role: opts.role ?? "member",
    passhash,
  };
  await db.insert(users).values(row);
  const [created] = await db.select().from(users).where(eq(users.id, row.id));
  return created;
}

export async function authenticateUser(
  name: string,
  password: string,
): Promise<User | null> {
  const user = await findUserByName(name);
  if (!user) return null;
  if (user.archivedAt) return null;
  const ok = await verifyPassword(password, user.passhash);
  if (!ok) return null;
  return user;
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1

export function generateInviteCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    out.push(INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length]);
    if (i === 3) out.push("-");
  }
  return out.join("");
}

export async function createInvite(opts: {
  createdById: string;
  note?: string | null;
  expiresInDays?: number;
}) {
  let code = generateInviteCode();
  // Vanishingly unlikely to collide, but if it does just retry once.
  const existing = await db.select().from(invites).where(eq(invites.code, code));
  if (existing.length > 0) code = generateInviteCode();
  const expiresAt = opts.expiresInDays
    ? new Date(Date.now() + opts.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  await db.insert(invites).values({
    id: uid("inv"),
    code,
    note: opts.note ?? null,
    createdById: opts.createdById,
    expiresAt,
  });
  return code;
}

export async function findInviteByCode(code: string) {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const rows = await db.select().from(invites).where(eq(invites.code, clean));
  return rows[0] ?? null;
}

export type InviteStatus = "valid" | "used" | "revoked" | "expired";

export function inviteStatus(
  invite: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date | null },
): InviteStatus {
  if (invite.usedAt) return "used";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now())
    return "expired";
  return "valid";
}

export async function redeemInvite(opts: {
  code: string;
  name: string;
  password: string;
}): Promise<User> {
  const invite = await findInviteByCode(opts.code);
  if (!invite) throw new Error("invalid invite code");
  const status = inviteStatus(invite);
  if (status !== "valid") {
    throw new Error(`invite ${status}`);
  }
  const user = await createUser({
    name: opts.name,
    password: opts.password,
    role: "member",
  });
  await db
    .update(invites)
    .set({ usedAt: new Date(), usedById: user.id })
    .where(eq(invites.id, invite.id));
  return user;
}
