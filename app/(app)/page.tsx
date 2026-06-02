import Link from "next/link";
import { sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { lectures, questions, attempts } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Play,
  BookOpen,
  Activity,
  Target,
  Gauge,
  ArrowRight,
} from "lucide-react";
import { formatDuration, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getStats() {
  const [lectureCount, questionCount, attemptCount, lastAttempt] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(lectures).then((r) => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)` }).from(questions).then((r) => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)` }).from(attempts).then((r) => r[0]?.c ?? 0),
    db
      .select()
      .from(attempts)
      .orderBy(desc(attempts.startedAt))
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);
  return { lectureCount, questionCount, attemptCount, lastAttempt };
}

export default async function DashboardPage() {
  const { lectureCount, questionCount, attemptCount, lastAttempt } = await getStats();
  const empty = questionCount === 0;
  const lastP =
    lastAttempt && lastAttempt.scoreTotal && lastAttempt.scoreTotal > 0
      ? pct(lastAttempt.scoreCorrect ?? 0, lastAttempt.scoreTotal)
      : null;

  return (
    <div className="space-y-10">
      {/* ----- HERO ----- */}
      <section className="relative overflow-hidden panel-deep p-8 sm:p-10 pop-in">
        <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-40" />
        <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-signal/8 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="dot text-signal" />
              <p className="eyebrow">Pre-race telemetry</p>
            </div>
            <h1 className="mt-3 display-xl text-foreground">
              Williams<span className="text-signal">Pod</span>
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground-dim">
              Wind tunnel before the Exam Pod race. Tighter timing, harder recall,
              stricter conditions than the official simulator. Train under worse
              conditions than the race.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!empty && (
                <Button asChild variant="signal" size="lg">
                  <Link href="/run/new">
                    <Play className="h-4 w-4" />
                    Start training run
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link href={empty ? "/upload" : "/bank"}>
                  {empty ? (
                    <>
                      <Upload className="h-4 w-4" />
                      Load bank
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-4 w-4" />
                      Open bank
                    </>
                  )}
                </Link>
              </Button>
            </div>
          </div>

          {/* Live instrument cluster */}
          <div className="relative">
            <div className="panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="eyebrow">Last sector</p>
                {lastAttempt?.aborted && <Badge tone="bad">Aborted</Badge>}
              </div>
              {lastAttempt ? (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <span className="digit text-5xl text-foreground">
                      {lastP != null ? lastP.toFixed(0) : "—"}
                    </span>
                    {lastP != null && (
                      <span className="text-2xl text-muted">%</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.16em]">
                    <MiniStat
                      label="score"
                      value={`${lastAttempt.scoreCorrect ?? "—"}/${lastAttempt.scoreTotal ?? "—"}`}
                    />
                    <MiniStat
                      label="time"
                      value={formatDuration(lastAttempt.timeUsedMs ?? 0)}
                    />
                    <MiniStat
                      label="flags"
                      value={String(lastAttempt.integrityFlagCount)}
                      tone={lastAttempt.integrityFlagCount > 0 ? "warn" : undefined}
                    />
                  </div>
                  <Link
                    href={`/run/${lastAttempt.id}/debrief`}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-signal hover:text-signal-strong"
                  >
                    Open debrief
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="digit text-5xl text-muted">—</span>
                  <p className="text-xs text-muted">No runs yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ----- STAT STRIP ----- */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="Lectures"
          value={lectureCount}
        />
        <StatTile
          icon={<Gauge className="h-3.5 w-3.5" />}
          label="Questions"
          value={questionCount}
        />
        <StatTile
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Training runs"
          value={attemptCount}
        />
        <StatTile
          icon={<Target className="h-3.5 w-3.5" />}
          label="Best %"
          value={lastP != null ? `${lastP}%` : "—"}
          tone={lastP != null && lastP >= 70 ? "good" : undefined}
        />
      </section>

      {/* ----- EMPTY STATE or ACTION CARDS ----- */}
      {empty ? (
        <div className="panel bg-grid p-8 pop-in">
          <div className="flex items-center gap-2">
            <span className="dot text-warn" />
            <p className="eyebrow">Pod empty</p>
          </div>
          <h2 className="mt-3 display-lg text-foreground">No questions loaded</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-dim">
            Upload an <span className="font-mono text-foreground">.xlsx</span> with
            one sheet per lecture. Expected columns:{" "}
            <span className="font-mono text-foreground">
              question, A, B, C, D, E, correct, explanation, topic, difficulty
            </span>
            .
          </p>
          <div className="mt-5">
            <Button asChild variant="signal" size="lg">
              <Link href="/upload">
                <Upload className="h-4 w-4" />
                Upload Excel
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          <ActionCard
            href="/run/new"
            eyebrow="Quick launch"
            title="Configure a training run"
            body="Pick lectures, set a shorter-than-real timer, enter the pod."
            cta={
              <>
                <Play className="h-4 w-4" />
                Configure
              </>
            }
            variant="signal"
          />
          <ActionCard
            href="/bank"
            eyebrow="Manage bank"
            title="Browse loaded lectures"
            body="Edit stems, choices, topics, or reorganize before the next run."
            cta={
              <>
                <BookOpen className="h-4 w-4" />
                Open
              </>
            }
          />
        </section>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "good" | "warn" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-good"
      : tone === "warn"
        ? "text-warn"
        : tone === "bad"
          ? "text-bad"
          : "text-foreground";
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-1.5 text-muted">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
          {label}
        </span>
      </div>
      <div className={`mt-2 digit text-3xl ${color}`}>{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "bad" | "good";
}) {
  const color =
    tone === "warn"
      ? "text-warn"
      : tone === "bad"
        ? "text-bad"
        : tone === "good"
          ? "text-good"
          : "text-foreground";
  return (
    <div className="rounded-sm border border-border bg-surface-2/60 px-2 py-1.5">
      <div className="text-muted">{label}</div>
      <div className={`mt-0.5 font-mono tabular text-xs ${color}`}>{value}</div>
    </div>
  );
}

function ActionCard({
  href,
  eyebrow,
  title,
  body,
  cta,
  variant = "outline",
}: {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: React.ReactNode;
  variant?: "signal" | "outline";
}) {
  return (
    <Link
      href={href}
      className="panel panel-hover group block p-6"
    >
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-foreground-dim">{body}</p>
      <div className="mt-5">
        <Button asChild variant={variant} size="md" className="pointer-events-none">
          <span>
            {cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Button>
      </div>
    </Link>
  );
}
