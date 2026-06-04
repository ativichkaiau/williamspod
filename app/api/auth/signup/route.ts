import { NextResponse } from "next/server";
import { z } from "zod";
import { issueSessionToken, setSessionCookie } from "@/lib/auth";
import { isValidDisplayName, redeemInvite } from "@/lib/users";

const Body = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(2).max(40),
  password: z.string().min(6).max(200),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  if (!isValidDisplayName(parsed.data.name)) {
    return NextResponse.json(
      { error: "name can only contain letters, numbers, spaces, and . - _ '" },
      { status: 400 },
    );
  }
  try {
    const user = await redeemInvite({
      code: parsed.data.code,
      name: parsed.data.name,
      password: parsed.data.password,
    });
    const token = await issueSessionToken(user.id);
    await setSessionCookie(token);
    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, role: user.role },
    });
  } catch (err) {
    const msg = (err as Error).message;
    const code = msg === "that name is taken" ? 409 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
