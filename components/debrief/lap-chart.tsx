import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PacingPoint } from "@/lib/debrief";
import type { TimingCategory } from "@/lib/telemetry/types";

const CAT_BAR: Record<TimingCategory, string> = {
  fast_correct: "bg-good",
  slow_correct: "bg-signal",
  fast_wrong: "bg-bad",
  slow_wrong: "bg-warn",
};

const CAT_LABEL: Record<TimingCategory, string> = {
  fast_correct: "fast + right",
  slow_correct: "slow + right",
  fast_wrong: "fast + wrong",
  slow_wrong: "slow + wrong",
};

/**
 * Time-per-question chart — seconds per question in order. Bar height is time,
 * colour is the timing category, and a dashed notch marks the suggested budget
 * for that question. A dashed line across the chart marks the median time.
 * Pure presentation of data already stored — no new data.
 */
export function LapChart({ pacing }: { pacing: PacingPoint[] }) {
  if (pacing.length === 0) return null;

  const max = Math.max(...pacing.map((p) => Math.max(p.timeSec, p.budgetSec)), 1);
  const times = [...pacing.map((p) => p.timeSec)].sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)] ?? 0;
  const fastest = times[0] ?? 0;
  const slowest = times[times.length - 1] ?? 0;
  const overBudget = pacing.filter((p) => p.answered && p.timeSec > p.budgetSec).length;
  const rushes = pacing.filter((p) => p.timingCategory === "fast_wrong").length;

  return (
    <section className="panel p-6">
      <div className="mb-1 flex items-center gap-2">
        <Timer className="h-3.5 w-3.5 text-signal" />
        <p className="eyebrow">Time per question</p>
      </div>
      <p className="mb-5 max-w-2xl text-[11px] leading-relaxed text-muted">
        Seconds spent on each question, in order. The dashed notch on each bar is
        its suggested time — bars poking above it are questions you spent longer
        on. Red bars are wrong answers you moved through quickly.
      </p>

      <div className="relative h-44 w-full">
        {/* Median lap reference */}
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-border-bright"
          style={{ bottom: `${(median / max) * 100}%` }}
        >
          <span className="absolute -top-2 right-0 bg-surface px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-strong">
            median {median}s
          </span>
        </div>

        <div className="flex h-full items-end gap-[2px] overflow-x-auto pb-px">
          {pacing.map((p) => {
            const cat = p.timingCategory;
            return (
              <div
                key={p.order}
                className="relative flex h-full min-w-[6px] flex-1 flex-col justify-end"
                title={`Q${p.order} · ${p.timeSec}s / ${p.budgetSec}s budget${
                  cat ? " · " + CAT_LABEL[cat] : ""
                }${p.answered ? "" : " · unanswered"}`}
              >
                {/* Budget notch (relative to the full-height column) */}
                <div
                  className="pointer-events-none absolute inset-x-0 h-px bg-foreground/25"
                  style={{ bottom: `${Math.min(100, (p.budgetSec / max) * 100)}%` }}
                />
                <div
                  className={cn(
                    "w-full rounded-t-[2px] transition-[height]",
                    cat ? CAT_BAR[cat] : "bg-muted",
                    !p.answered && "opacity-40",
                  )}
                  style={{ height: `${Math.max(2, (p.timeSec / max) * 100)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/70 pt-4">
        {(Object.keys(CAT_BAR) as TimingCategory[]).map((c) => (
          <span key={c} className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted">
            <span className={cn("inline-block h-2.5 w-2.5 rounded-[2px]", CAT_BAR[c])} />
            {CAT_LABEL[c]}
          </span>
        ))}
      </div>

      {/* Pace stats */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <PaceStat label="Fastest" value={`${fastest}s`} />
        <PaceStat label="Median" value={`${median}s`} />
        <PaceStat label="Slowest" value={`${slowest}s`} />
        <PaceStat
          label="Over budget"
          value={String(overBudget)}
          tone={overBudget > 0 ? "warn" : undefined}
        />
        <PaceStat
          label="Fast + wrong"
          value={String(rushes)}
          tone={rushes > 0 ? "bad" : undefined}
        />
      </div>
    </section>
  );
}

function PaceStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "bad";
}) {
  const color =
    tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-foreground";
  return (
    <div className="clay-inset px-3 py-2">
      <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className={cn("mt-0.5 digit text-base", color)}>{value}</div>
    </div>
  );
}
