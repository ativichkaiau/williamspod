"use client";

import { useState } from "react";
import { RadioTower, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; text: string; provider: string }
  | { kind: "error"; message: string };

/**
 * "Ask the race engineer" — on-demand AI debrief for one wrong answer. Calls
 * POST /api/attempts/[id]/explain, which grounds the reply in the question's
 * explanation and the run's telemetry. Offline it still returns a useful
 * placeholder debrief, so the button never dead-ends.
 */
export function RaceEngineer({
  attemptId,
  questionId,
}: {
  attemptId: string;
  questionId: string;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function ask() {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/attempts/${attemptId}/explain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.text) {
        setState({
          kind: "error",
          message: json.error ?? "The engineer's radio cut out. Try again.",
        });
        return;
      }
      setState({ kind: "done", text: json.text, provider: json.provider });
    } catch {
      setState({ kind: "error", message: "Radio failure. Try again." });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="mt-4 rounded-md border border-signal/25 bg-signal-soft p-3.5 pop-in">
        <div className="mb-1.5 flex items-center gap-1.5">
          <RadioTower className="h-3 w-3 text-signal" />
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-signal">
            Race engineer
          </p>
          {state.provider === "placeholder" && (
            <span className="text-[9px] uppercase tracking-[0.14em] text-muted">
              · offline
            </span>
          )}
        </div>
        {state.text.split(/\n\n+/).map((para, i) => (
          <p
            key={i}
            className="mt-1.5 text-xs leading-relaxed text-foreground-dim first:mt-0"
          >
            {para}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={ask}
        disabled={state.kind === "loading"}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3.5 py-2 text-xs font-semibold text-foreground shadow-[var(--clay-chip)] transition-all hover:brightness-105 active:shadow-[var(--clay-inset)] disabled:opacity-60",
        )}
      >
        {state.kind === "loading" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-signal" />
            Engineer is reviewing the data lap…
          </>
        ) : (
          <>
            <RadioTower className="h-3.5 w-3.5 text-signal" />
            Ask the race engineer
          </>
        )}
      </button>
      {state.kind === "error" && (
        <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-bad">
          {state.message}
        </p>
      )}
    </div>
  );
}
