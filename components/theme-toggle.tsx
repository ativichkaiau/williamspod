"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const THEME_KEY = "williamspod-theme";
const THEME_CHANGE_EVENT = "williamspod-theme-change";
type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.style.colorScheme = theme;

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be unavailable in private contexts; the visual switch still works.
  }

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function getCurrentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => onStoreChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener(THEME_CHANGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(THEME_CHANGE_EVENT, handleChange);
  };
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getCurrentTheme, () => "dark");
  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted shadow-[var(--clay-chip)] transition-all hover:text-foreground active:shadow-[var(--clay-inset)]",
        className,
      )}
      aria-label={theme === "dark" ? "Switch to day mode" : "Switch to night mode"}
      title={theme === "dark" ? "Day mode" : "Night mode"}
      onClick={() => applyTheme(nextTheme)}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
