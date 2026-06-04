import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth";
import { createInvite } from "@/lib/users";

const Body = z.object({
  note: z.string().max(120).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export async function POST(req: Request) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const code = await createInvite({
    createdById: auth.user.id,
    note: parsed.data.note ?? null,
    expiresInDays: parsed.data.expiresInDays,
  });
  return NextResponse.json({ ok: true, code });
}
