import { NextResponse } from "next/server";
import { z } from "zod";
import { issueSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const ok = await verifyPassword(parsed.data.password);
  if (!ok) {
    return NextResponse.json({ error: "Invalid passphrase." }, { status: 401 });
  }
  const token = await issueSessionToken();
  await setSessionCookie(token);
  return NextResponse.json({ ok: true });
}
