import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteAttemptButton } from "@/components/delete-attempt-button";
import { Play, ChevronRight, Activity } from "lucide-react";
import { formatDuration, pct } from "@/lib/utils";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Races — WilliamsPod" };
export const dynamic = "force-dynamic";

export default async function RunsHubPage() {
  const user = await requireUser();
  const recent = await db
    .select()
    .from(attempts)
    .where(eq(attempts.userId, user.id))
    .orderBy(desc(attempts.startedAt))
    .limit(20);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="dot text-signal" />
            <p className="eyebrow">Race weekends</p>
          </div>
          <h1 className="mt-2 display-lg text-foreground">
            Races<span className="race-lean text-signal">.</span>
          </h1>
          <p className="mt-2 text-sm text-foreground-dim">
            Enter a new race or walk back through past stints.
          </p>
        </div>
        <Button asChild variant="signal" size="lg">
          <Link href="/run/new">
            <Play className="h-4 w-4" />
            Race entry
          </Link>
        </Button>
      </header>

      {recent.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 py-14 text-center">
          <Activity className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">
            No races on the board. Lights out when you are.
          </p>
          <Button asChild variant="signal" className="mt-2">
            <Link href="/run/new">
              <Play className="h-4 w-4" />
              Race entry
            </Link>
          </Button>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="eyebrow">Recent stints</p>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {recent.length} shown
            </span>
          </div>
          <ul className="divide-y divide-border">
            {recent.map((a) => {
              const submitted = !!a.submittedAt;
              const score =
                a.scoreCorrect != null && a.scoreTotal != null
                  ? `${a.scoreCorrect}/${a.scoreTotal}`
                  : "—";
              const scorePct =
                a.scoreCorrect != null &&
                a.scoreTotal != null &&
                a.scoreTotal > 0
                  ? pct(a.scoreCorrect, a.scoreTotal)
                  : null;
              const scoreColor =
                scorePct == null
                  ? "text-muted"
                  : scorePct >= 70
                    ? "text-good"
                    : scorePct < 50
                      ? "text-bad"
                      : "text-foreground";
              return (
                <li
                  key={a.id}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <Link
                    href={submitted ? `/run/${a.id}/debrief` : `/pod/${a.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <Activity className="h-3.5 w-3.5 text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-mono text-xs tabular text-muted">
                          {new Date(a.startedAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                        {a.label && (
                          <span className="font-bold text-foreground">{a.label}</span>
                        )}
                        {!submitted && <Badge tone="warn">On track</Badge>}
                        {a.aborted && <Badge tone="bad">Retired</Badge>}
                        {a.integrityFlagCount > 0 && submitted && (
                          <Badge tone="warn">
                            {a.integrityFlagCount} flag
                            {a.integrityFlagCount === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted">
                        {a.questionCount} Q · {formatDuration(a.durationMs)} budget
                        {a.timeUsedMs != null
                          ? ` · ${formatDuration(a.timeUsedMs)} used`
                          : ""}
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <div className={`digit text-base font-bold ${scoreColor}`}>{score}</div>
                      {scorePct != null && (
                        <div className="font-mono text-[10px] tabular text-muted">
                          {scorePct}%
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                  <DeleteAttemptButton
                    attemptId={a.id}
                    label={a.label ?? "Race"}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
