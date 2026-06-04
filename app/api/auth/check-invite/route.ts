import { NextResponse } from "next/server";
import { findInviteByCode, inviteStatus } from "@/lib/users";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }
  const invite = await findInviteByCode(code);
  if (!invite) {
    return NextResponse.json({ status: "invalid" });
  }
  return NextResponse.json({ status: inviteStatus(invite) });
}
