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

export function ThemeToggle({
  className,
  labeled = false,
}: {
  className?: string;
  /** Include the current mode ("Day" / "Night") beside the icon. */
  labeled?: boolean;
}) {
  const theme = useSyncExternalStore(subscribe, getCurrentTheme, () => "dark");
  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const isDay = theme === "light";
  // The label reflects the current mode; the icon matches it.
  const Icon = isDay ? Sun : Moon;

  if (labeled) {
    return (
      <button
        type="button"
        className={cn(
          "flex h-10 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-2",
          className,
        )}
        aria-label={isDay ? "Switch to night mode" : "Switch to day mode"}
        title={isDay ? "Switch to night mode" : "Switch to day mode"}
        onClick={() => applyTheme(nextTheme)}
      >
        <Icon
          className={cn("h-3.5 w-3.5", isDay ? "text-warn" : "text-signal")}
        />
        {isDay ? "Day" : "Night"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground",
        className,
      )}
      aria-label={isDay ? "Switch to night mode" : "Switch to day mode"}
      title={isDay ? "Switch to night mode" : "Switch to day mode"}
      onClick={() => applyTheme(nextTheme)}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
