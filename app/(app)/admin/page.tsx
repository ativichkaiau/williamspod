import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts, invites, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { inviteStatus } from "@/lib/users";
import { AdminTools } from "./admin-tools";

export const metadata = { title: "Admin — WilliamsPod" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");

  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      archivedAt: users.archivedAt,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
      attemptCount: sql<number>`(select count(*) from ${attempts} where ${attempts.userId} = ${users.id})`,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const inviteRows = await db
    .select({
      id: invites.id,
      code: invites.code,
      note: invites.note,
      createdAt: invites.createdAt,
      expiresAt: invites.expiresAt,
      usedAt: invites.usedAt,
      usedById: invites.usedById,
      revokedAt: invites.revokedAt,
      createdByName: users.name,
    })
    .from(invites)
    .leftJoin(users, eq(users.id, invites.createdById))
    .orderBy(desc(invites.createdAt));

  return (
    <AdminTools
      adminId={user.id}
      users={userRows.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        archived: !!u.archivedAt,
        attemptCount: Number(u.attemptCount ?? 0),
        createdAt: new Date(u.createdAt).toISOString(),
        lastSeenAt: u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : null,
      }))}
      invites={inviteRows.map((i) => ({
        id: i.id,
        code: i.code,
        note: i.note,
        createdByName: i.createdByName,
        createdAt: new Date(i.createdAt).toISOString(),
        expiresAt: i.expiresAt ? new Date(i.expiresAt).toISOString() : null,
        usedAt: i.usedAt ? new Date(i.usedAt).toISOString() : null,
        revokedAt: i.revokedAt ? new Date(i.revokedAt).toISOString() : null,
        status: inviteStatus({
          usedAt: i.usedAt ? new Date(i.usedAt) : null,
          revokedAt: i.revokedAt ? new Date(i.revokedAt) : null,
          expiresAt: i.expiresAt ? new Date(i.expiresAt) : null,
        }),
      }))}
    />
  );
}
