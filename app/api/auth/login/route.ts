import { NextResponse } from "next/server";
import { z } from "zod";
import { issueSessionToken, setSessionCookie } from "@/lib/auth";
import { authenticateUser, touchLastSeen } from "@/lib/users";

const Body = z.object({
  name: z.string().min(1).max(60),
  password: z.string().min(1).max(200),
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
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const user = await authenticateUser(parsed.data.name, parsed.data.password);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid name or passphrase." },
      { status: 401 },
    );
  }
  const token = await issueSessionToken(user.id);
  await setSessionCookie(token);
  void touchLastSeen(user.id);
  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: user.role },
  });
}
