"use client";

import { useEffect, useRef } from "react";

export function AnimatedNumber({
  value,
  suffix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const formatted = value.toFixed(decimals) + suffix;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.textContent = formatted;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || !Number.isFinite(value) || value === 0) return;

    let frame = 0;
    let observer: IntersectionObserver | undefined;
    const finish = () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      element.textContent = formatted;
    };
    const start = () => {
      const startedAt = performance.now();
      const draw = (now: number) => {
        const progress = Math.min((now - startedAt) / 1100, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = (value * eased).toFixed(decimals) + suffix;
        if (progress < 1) frame = requestAnimationFrame(draw);
        else finish();
      };
      frame = requestAnimationFrame(draw);
    };

    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          start();
        }
      }, { threshold: 0.3 });
      observer.observe(element);
    } else {
      start();
    }

    const onPreferenceChange = () => { if (preference.matches) finish(); };
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [value, suffix, decimals, formatted]);

  return (
    <span className="relative inline-block">
      {/* Reserve the final width; assistive technology reads the exact value. */}
      <span className="invisible" aria-hidden="true">{formatted}</span>
      <span ref={ref} className="absolute inset-0" aria-hidden="true">{formatted}</span>
      <span className="sr-only">{formatted}</span>
    </span>
  );
}
