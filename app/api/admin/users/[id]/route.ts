import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { apiAuth } from "@/lib/auth";

const PatchBody = z.object({
  action: z.enum(["archive", "unarchive", "promote", "demote"]),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const admin = auth.user;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (id === admin.id) {
    return NextResponse.json(
      { error: "cannot modify your own account" },
      { status: 409 },
    );
  }
  switch (parsed.data.action) {
    case "archive":
      await db
        .update(users)
        .set({ archivedAt: new Date() })
        .where(eq(users.id, id));
      break;
    case "unarchive":
      await db.update(users).set({ archivedAt: null }).where(eq(users.id, id));
      break;
    case "promote":
      await db.update(users).set({ role: "admin" }).where(eq(users.id, id));
      break;
    case "demote":
      await db.update(users).set({ role: "member" }).where(eq(users.id, id));
      break;
  }
  return NextResponse.json({ ok: true });
}
