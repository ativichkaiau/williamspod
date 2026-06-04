import Link from "next/link";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteAttemptButton } from "@/components/delete-attempt-button";
import { formatDuration, pct } from "@/lib/utils";
import { Activity, ChevronRight, Play } from "lucide-react";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "History — WilliamsPod" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(attempts)
    .where(
      and(eq(attempts.userId, user.id), isNotNull(attempts.submittedAt)),
    )
    .orderBy(desc(attempts.startedAt))
    .limit(100);

  if (rows.length === 0) {
    return (
      <div className="space-y-8">
        <header>
          <div className="flex items-center gap-2">
            <span className="dot text-signal" />
            <p className="eyebrow">History</p>
          </div>
          <h1 className="mt-2 display-lg text-foreground">Past training runs</h1>
        </header>
        <div className="panel flex flex-col items-center gap-3 py-14 text-center">
          <Activity className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">No submitted runs yet.</p>
          <Button asChild variant="signal" className="mt-2">
            <Link href="/run/new">
              <Play className="h-4 w-4" />
              Configure run
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const totalRuns = rows.length;
  const sumCorrect = rows.reduce((s, r) => s + (r.scoreCorrect ?? 0), 0);
  const sumTotal = rows.reduce((s, r) => s + (r.scoreTotal ?? 0), 0);
  const avgPct = sumTotal > 0 ? pct(sumCorrect, sumTotal) : 0;
  const totalFlags = rows.reduce((s, r) => s + r.integrityFlagCount, 0);
  const totalTime = rows.reduce((s, r) => s + (r.timeUsedMs ?? 0), 0);

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <span className="dot text-signal" />
          <p className="eyebrow">History</p>
        </div>
        <h1 className="mt-2 display-lg text-foreground">Past training runs</h1>
        <p className="mt-1 text-sm text-foreground-dim">
          <span className="digit text-foreground">{totalRuns}</span> submitted run
          {totalRuns === 1 ? "" : "s"}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Submitted runs" value={String(totalRuns)} />
        <Stat
          label="Average score"
          value={`${avgPct}%`}
          tone={avgPct >= 70 ? "good" : avgPct < 50 ? "bad" : undefined}
        />
        <Stat label="Total in pod" value={formatDuration(totalTime)} />
        <Stat
          label="Total flags"
          value={String(totalFlags)}
          tone={totalFlags > 0 ? "warn" : undefined}
        />
      </section>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="eyebrow">All runs</p>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((a) => {
            const correct = a.scoreCorrect ?? 0;
            const total = a.scoreTotal ?? 0;
            const p = total > 0 ? pct(correct, total) : 0;
            const tone = p >= 70 ? "good" : p < 50 ? "bad" : "neutral";
            const barColor =
              tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : "bg-signal";
            const txtColor =
              tone === "good"
                ? "text-good"
                : tone === "bad"
                  ? "text-bad"
                  : "text-foreground";
            return (
              <li
                key={a.id}
                className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
              >
                <Link
                  href={`/run/${a.id}/debrief`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <div className="w-28 font-mono text-xs tabular text-muted">
                    {new Date(a.startedAt).toLocaleDateString()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-foreground">{a.label ?? "Pod run"}</span>
                      {a.aborted && <Badge tone="bad">Aborted</Badge>}
                      {a.integrityFlagCount > 0 && (
                        <Badge tone="warn">
                          {a.integrityFlagCount} flag
                          {a.integrityFlagCount === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted">
                      {total} Q · {formatDuration(a.timeUsedMs ?? 0)} of{" "}
                      {formatDuration(a.durationMs)}
                    </div>
                  </div>
                  <div className="w-24">
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-border">
                      <div
                        className={`h-full ${barColor} transition-[width]`}
                        style={{ width: `${p}%` }}
                      />
                    </div>
                  </div>
                  <div className={`w-14 text-right digit text-sm ${txtColor}`}>
                    {p}%
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
                <DeleteAttemptButton
                  attemptId={a.id}
                  label={a.label ?? "Pod run"}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "warn";
}) {
  const color =
    tone === "good"
      ? "text-good"
      : tone === "bad"
        ? "text-bad"
        : tone === "warn"
          ? "text-warn"
          : "text-foreground";
  return (
    <div className="panel-flat p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className={`mt-1 digit text-2xl ${color}`}>{value}</div>
    </div>
  );
}
