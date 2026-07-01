"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Gauge,
  BookOpen,
  Upload,
  Play,
  History,
  LogOut,
  Shield,
} from "lucide-react";

type ShellUser = { id: string; name: string; role: "admin" | "member" };

const MEMBER_LINKS = [
  { href: "/", label: "Telemetry", icon: Gauge },
  { href: "/bank", label: "Bank", icon: BookOpen },
  { href: "/run", label: "Run", icon: Play },
  { href: "/history", label: "History", icon: History },
];

const ADMIN_EXTRA = [
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/admin", label: "Admin", icon: Shield },
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
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-signal/10 text-signal shadow-[0_6px_14px_-6px_rgba(45,212,241,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.25),inset_0_-3px_6px_-3px_rgba(0,0,0,0.4)]">
              <span className="font-mono text-[10px] font-bold tracking-[0.18em]">WP</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-foreground">
                Williams<span className="text-signal">Pod</span>
              </span>
              <span className="mt-0.5 text-[9px] uppercase tracking-[0.22em] text-muted">
                exam telemetry
              </span>
            </div>
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
                    "relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] transition-all",
                    active
                      ? "bg-surface-2 text-foreground shadow-[var(--clay-chip)]"
                      : "text-muted hover:bg-surface-2/60 hover:text-foreground-dim",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {active && (
                    <span className="pointer-events-none absolute -bottom-[7px] left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-signal shadow-[0_0_10px_0_rgba(45,212,241,0.7)]" />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-foreground shadow-[var(--clay-chip)]">
                {initial}
              </div>
              <div className="flex flex-col leading-none">
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
          <span className="font-mono tabular">v0.2</span>
        </div>
      </footer>
    </div>
  );
}
