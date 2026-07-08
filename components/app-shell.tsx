"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { WilliamsPodLogo } from "@/components/brand/williamspod-logo";
import {
  Gauge,
  Warehouse,
  Upload,
  Flag,
  Trophy,
  History,
  LogOut,
  Shield,
} from "lucide-react";

type ShellUser = { id: string; name: string; role: "admin" | "member" };

const MEMBER_LINKS = [
  { href: "/", label: "Pit wall", icon: Gauge },
  { href: "/bank", label: "Garage", icon: Warehouse },
  { href: "/run", label: "Race", icon: Flag },
  { href: "/standings", label: "Championship", icon: Trophy },
  { href: "/history", label: "Season", icon: History },
];

const ADMIN_EXTRA = [
  { href: "/upload", label: "Parts", icon: Upload },
  { href: "/admin", label: "Control", icon: Shield },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: ShellUser;
}) {
  const pathname = usePathname();
  const links = user.role === "admin" ? [...MEMBER_LINKS, ...ADMIN_EXTRA] : MEMBER_LINKS;
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="livery-stripe h-[3px] w-full" />
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:gap-4">
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <WilliamsPodLogo
              size="md"
              subtitle="Wind Tunnel"
              wordmarkClassName="hidden sm:flex"
            />
            <span className="hidden items-center rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted-strong shadow-[var(--clay-chip)] lg:inline-flex">
              <span>VESTRIPPN</span>
              <span className="text-brand">3.0</span>
              <span>&nbsp;· M-8</span>
            </span>
          </Link>
          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {links.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-all",
                    active
                      ? "bg-surface-2 text-foreground shadow-[var(--clay-chip)]"
                      : "text-muted hover:bg-surface-2/60 hover:text-foreground-dim",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {active && (
                    <span className="pointer-events-none absolute -bottom-[7px] left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-wm-yellow shadow-[0_0_10px_0_rgba(255,204,0,0.7)]" />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle labeled />
            <span className="mx-0.5 hidden h-5 w-px bg-border sm:inline-block" />
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-foreground shadow-[var(--clay-chip)]">
                {initial}
              </div>
              <div className="hidden flex-col leading-none xl:flex">
                <span className="text-[11px] font-bold tracking-tight text-foreground">
                  {user.name}
                </span>
                <span className="text-[9px] uppercase tracking-[0.18em] text-muted">
                  {user.role === "admin" ? "admin" : "member"}
                </span>
              </div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        {children}
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-muted">
          <div className="flex items-center gap-2">
            <span className="dot text-signal" />
            <span>Wind tunnel — not the race</span>
          </div>
          <span className="font-mono tabular">FW15C spec · v0.2</span>
        </div>
      </footer>
    </div>
  );
}
