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
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/bank", label: "Bank", icon: Warehouse },
  { href: "/run", label: "Practice", icon: Flag },
  { href: "/standings", label: "Progress", icon: Trophy },
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
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div aria-hidden="true" className="livery-stripe h-[3px] w-full" />
        <div className="mx-auto flex min-h-20 w-full max-w-6xl flex-wrap items-center gap-x-6 px-5 pt-4 sm:px-6 xl:flex-nowrap xl:py-0">
          <Link href="/" aria-label="WilliamsPod dashboard" className="flex shrink-0 items-center gap-3">
            <WilliamsPodLogo
              size="md"
              subtitle="Exam Practice"
            />
          </Link>
          <nav aria-label="Main navigation" className="order-last mt-3 flex w-full min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:order-none xl:mt-0 xl:w-auto xl:flex-1 xl:justify-center">
            {links.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium transition-colors focus-visible:-outline-offset-4",
                    active
                      ? "border-signal text-foreground"
                      : "border-transparent text-muted hover:border-border-strong hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <span className="mx-0.5 hidden h-5 w-px bg-border sm:inline-block" />
            <div className="hidden items-center gap-2 sm:flex">
              <div title={user.name} className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-xs font-medium text-foreground">
                {initial}
              </div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="page-frame mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <div aria-hidden="true" className="flex h-2 gap-3">
          <span className="livery-stripe w-16" />
          <span className="track-hatch flex-1" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span>Practice under exam conditions</span>
          </div>
          <span className="flex items-center gap-3">
            <span className="text-[11px] tracking-wide">VESTRIPPN<span className="text-brand">3.0</span> · M-8</span>
            <span className="font-mono tabular">v0.2</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
