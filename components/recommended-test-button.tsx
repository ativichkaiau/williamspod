"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Builds a Recommended test (due spaced-repetition items first, then weak, then
 * fresh) via POST /api/attempts/recommended, then jumps into it. Used on the
 * practice page and the dashboard.
 */
export function RecommendedTestButton({
  variant = "signal",
  size = "lg",
  className,
  label = "Start review test",
}: {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/attempts/recommended", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.attemptId) {
        setError(json.error ?? "Couldn't build a review test.");
        setBusy(false);
        return;
      }
      router.push(`/pod/${json.attemptId}`);
    } catch {
      setError("Couldn't build a review test.");
      setBusy(false);
    }
  }

  return (
    <div className={cn("inline-flex flex-col", className)}>
      <Button variant={variant} size={size} onClick={start} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Building…
          </>
        ) : (
          <>
            {label}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
      {error && (
        <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
