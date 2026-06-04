import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    // The middleware should have already redirected, but belt and suspenders.
    redirect("/login");
  }
  return (
    <AppShell
      user={{ id: user.id, name: user.name, role: user.role }}
    >
      {children}
    </AppShell>
  );
}
