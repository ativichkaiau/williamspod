import { Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalibrationReport } from "@/lib/telemetry/calibration";

const LEVEL_LABEL: Record<number, string> = {
  1: "guess",
  2: "shaky",
  3: "even",
  4: "confident",
  5: "certain",
};

/**
 * Confidence calibration — "where your telemetry lies". Shows a Brier score, an
 * overall verdict, the confidently-wrong count (the dangerous quadrant), and a
 * predicted-vs-actual curve per conviction level.
 */
export function CalibrationPanel({ report }: { report: CalibrationReport }) {
  const verdict =
    report.bias > 0.1
      ? { label: "Overconfident", tone: "bad" as const, blurb: "your convictions outrun your accuracy — ease off before the real exam." }
      : report.bias < -0.1
        ? { label: "Underconfident", tone: "signal" as const, blurb: "you know more than you back yourself for — trust the first read." }
        : { label: "Well calibrated", tone: "good" as const, blurb: "your conviction tracks your accuracy. Keep it there." };

  const verdictColor =
    verdict.tone === "bad"
      ? "text-bad"
      : verdict.tone === "signal"
        ? "text-signal"
        : "text-good";

  const buckets = report.buckets.filter((b) => b.count > 0);

  return (
    <section className="panel p-6">
      <div className="mb-4 flex items-center gap-2">
        <Crosshair className="h-3.5 w-3.5 text-signal" />
        <p className="eyebrow">Confidence calibration</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="clay-inset p-3.5 sm:col-span-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            Brier score
          </div>
          <div className="mt-1 digit text-2xl text-foreground">
            {report.brier.toFixed(3)}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted">
            0 = perfect
          </div>
        </div>
        <div className="clay-inset p-3.5 sm:col-span-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            Verdict
          </div>
          <div className={cn("mt-1 text-lg font-bold", verdictColor)}>
            {verdict.label}
          </div>
          <p className="mt-0.5 text-xs text-foreground-dim">{verdict.blurb}</p>
        </div>
      </div>

      {/* Dangerous quadrants */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <QuadTile
          label="Confidently wrong"
          value={report.overconfident}
          hint="conviction ≥ confident, still missed"
          tone={report.overconfident > 0 ? "bad" : "good"}
        />
        <QuadTile
          label="Needlessly hesitant"
          value={report.underconfident}
          hint="rated it a guess, got it right"
          tone={report.underconfident > 0 ? "signal" : "good"}
        />
      </div>

      {/* Predicted vs actual per conviction level */}
      <div className="mt-5 space-y-3 border-t border-border/70 pt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          Claimed vs actual
        </p>
        {buckets.map((b) => {
          const actual = b.accuracy ?? 0;
          const claimed = b.predicted;
          // Overconfident bucket: actual well under what conviction claimed.
          const off = claimed - actual;
          const barTone =
            off > 0.2 ? "bg-bad" : off < -0.2 ? "bg-signal" : "bg-good";
          return (
            <div key={b.confidence} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-foreground-dim">
                  {b.confidence} · {LEVEL_LABEL[b.confidence]}
                </span>
                <span className="font-mono tabular text-muted">
                  claimed {Math.round(claimed * 100)}% · actual{" "}
                  <span className="text-foreground">{Math.round(actual * 100)}%</span>{" "}
                  ({b.count} Q)
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-border">
                <div
                  className={cn("h-full rounded-full", barTone)}
                  style={{ width: `${Math.round(actual * 100)}%` }}
                />
                {/* Claimed marker */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-foreground/70"
                  style={{ left: `${Math.round(claimed * 100)}%` }}
                  title={`claimed ${Math.round(claimed * 100)}%`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Rated {report.rated} question{report.rated === 1 ? "" : "s"}. The tick is
        what your conviction claimed; the bar is what you actually scored.
      </p>
    </section>
  );
}

function QuadTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "bad" | "signal" | "good";
}) {
  const color =
    tone === "bad" ? "text-bad" : tone === "signal" ? "text-signal" : "text-good";
  return (
    <div className="clay-inset p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className={cn("mt-1 digit text-2xl", color)}>{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted">
        {hint}
      </div>
    </div>
  );
}
