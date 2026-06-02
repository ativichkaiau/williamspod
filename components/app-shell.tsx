"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Gauge, BookOpen, Upload, Play, History, LogOut } from "lucide-react";

const links = [
  { href: "/", label: "Telemetry", icon: Gauge },
  { href: "/bank", label: "Bank", icon: BookOpen },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/run", label: "Run", icon: Play },
  { href: "/history", label: "History", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-8 px-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-[5px] border border-signal/40 bg-signal/8 text-signal shadow-[inset_0_1px_0_0_rgba(45,212,241,0.25),0_0_12px_-4px_rgba(45,212,241,0.6)]">
              <span className="font-mono text-[10px] font-bold tracking-[0.18em]">WP</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground">
                Williams<span className="text-signal">Pod</span>
              </span>
              <span className="mt-0.5 text-[9px] uppercase tracking-[0.22em] text-muted">
                exam telemetry
              </span>
            </div>
          </Link>
          <nav className="flex flex-1 items-center gap-0.5">
            {links.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted hover:bg-surface-2 hover:text-foreground-dim",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {active && (
                    <span className="pointer-events-none absolute inset-x-2 -bottom-[15px] h-[2px] rounded-full bg-signal shadow-[0_0_8px_0_rgba(45,212,241,0.6)]" />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 text-[9px] uppercase tracking-[0.22em] text-muted md:flex">
              <span className="dot text-good" />
              <span>live</span>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-[5px] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted hover:bg-surface-2 hover:text-foreground"
                aria-label="Sign out"
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
          <span className="font-mono tabular">v0.1</span>
        </div>
      </footer>
    </div>
  );
}
