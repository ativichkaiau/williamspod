"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Animate new pages without remounting their forms or changing layout. */
export function PageMotion({
  children,
  className,
  nested = false,
}: {
  children: React.ReactNode;
  className?: string;
  nested?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const root = ref.current;
    if (!root || typeof root.animate !== "function") return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;

    const scope = nested ? root.firstElementChild : root;
    const animations: Animation[] = [];
    const items = Array.from(scope?.children ?? []).filter(
      (item): item is HTMLElement => item instanceof HTMLElement && !["SCRIPT", "STYLE", "LINK"].includes(item.tagName),
    );

    items.forEach((item, index) => {
      if (item.contains(document.activeElement)) return;
      animations.push(item.animate(
        [
          { opacity: 0, translate: "0 24px" },
          { opacity: 1, translate: "0 0" },
        ],
        {
          duration: 650,
          delay: Math.min(index, 5) * 90,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "backwards",
        },
      ));
    });

    const cancel = () => animations.forEach((animation) => animation.cancel());
    // A focused field or link must be immediately visible and steady.
    const onPreferenceChange = () => { if (preference.matches) cancel(); };
    root.addEventListener("focusin", cancel);
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      cancel();
      root.removeEventListener("focusin", cancel);
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [pathname, nested]);

  return <div ref={ref} className={className}>{children}</div>;
}
