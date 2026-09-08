import Link from "next/link";
import { sql, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lectures, questions, attempts } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
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

async function getStats(userId: string) {
  const [lectureCount, questionCount, attemptCount, lastAttempt] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(lectures).then((r) => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)` }).from(questions).then((r) => r[0]?.c ?? 0),
    db
      .select({ c: sql<number>`count(*)` })
      .from(attempts)
      .where(eq(attempts.userId, userId))
      .then((r) => r[0]?.c ?? 0),
    db
      .select()
      .from(attempts)
      .where(eq(attempts.userId, userId))
      .orderBy(desc(attempts.startedAt))
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);
  return { lectureCount, questionCount, attemptCount, lastAttempt };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const { lectureCount, questionCount, attemptCount, lastAttempt } = await getStats(user.id);
  const empty = questionCount === 0;
  const lastP =
    lastAttempt && lastAttempt.scoreTotal && lastAttempt.scoreTotal > 0
      ? pct(lastAttempt.scoreCorrect ?? 0, lastAttempt.scoreTotal)
      : null;

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ----- HERO ----- */}
      <section className="relative overflow-hidden border-y border-border bg-surface px-6 py-8 sm:px-8 sm:py-10 pop-in">
        <div aria-hidden="true" className="racing-stripes parallax-stripes absolute inset-y-0 right-0 w-12 sm:w-24" />
        <div className="relative grid gap-8 pr-4 sm:pr-14 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
          <div>
            <p className="eyebrow">Dashboard</p>
            <div className="mt-3 flex items-center gap-4">
              <h1 className="display-xl text-foreground">
                Williams<span className="race-lean text-signal">Pod</span>
              </h1>
            </div>
            <p className="mt-4 max-w-md text-base leading-relaxed text-foreground-dim">
              Train your recall and timing under stricter exam conditions.
              Make the real Exam Pod feel easier.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!empty && (
                <Button asChild variant="signal" className="max-sm:w-full">
                  <Link href="/run/new">
                    Start practice test
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="max-sm:w-full">
                <Link href={empty ? "/upload" : "/bank"}>
                  {empty ? (
                    <>
                      <Upload className="h-4 w-4" />
                      Add questions
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

          {/* Latest result shares the hero's surface. */}
          <div className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="eyebrow">Last test</p>
                {lastAttempt?.aborted && <Badge tone="bad">Aborted</Badge>}
              </div>
              {lastAttempt ? (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <span className="digit text-5xl font-medium text-foreground">
                      {lastP != null ? lastP.toFixed(0) : "—"}
                    </span>
                    {lastP != null && (
                      <span className="text-2xl text-muted">%</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
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
                    className="mt-2 inline-flex items-center gap-2 text-sm text-signal hover:text-signal-strong"
                  >
                    View results
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="digit text-5xl font-medium text-muted">—</span>
                  <p className="text-sm text-muted">Your first result starts here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ----- STAT STRIP ----- */}
      <section aria-label="Practice statistics" className="reveal-stagger grid grid-cols-2 gap-x-6 gap-y-7 border-b border-border pb-8 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
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
          label="Tests taken"
          value={attemptCount}
        />
        <StatTile
          icon={<Target className="h-3.5 w-3.5" />}
          label="Last result"
          value={lastP != null ? `${lastP}%` : "—"}
          tone={lastP != null && lastP >= 70 ? "good" : undefined}
        />
      </section>

      {/* ----- EMPTY STATE or ACTION CARDS ----- */}
      {empty ? (
        <div className="panel relative overflow-hidden p-6 sm:p-8 pop-in">
          <div aria-hidden="true" className="track-hatch hatch-scroll absolute inset-x-0 top-0 h-2" />
          <div className="flex items-center gap-2">
            <span className="dot text-warn" />
            <p className="eyebrow">Bank empty</p>
          </div>
          <h2 className="mt-3 display-lg text-foreground">No questions yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-dim">
            Upload an <span className="font-mono text-foreground">.xlsx</span>{" "}
            with one sheet per lecture. Expected columns:{" "}
            <span className="font-mono text-foreground">
              question, A, B, C, D, E, correct, explanation, topic, difficulty
            </span>
            .
          </p>
          <div className="mt-5">
            <Button asChild variant="signal" size="lg">
              <Link href="/upload">
                <Upload className="h-4 w-4" />
                Upload questions
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <section aria-label="Practice tools" className="reveal-stagger grid gap-4 lg:grid-cols-2">
          <ActionCard
            number="01"
            href="/run/new"
            eyebrow="New test"
            title="Set up a practice test"
            body="Pick lectures, set a tighter-than-real timer, and start."
            cta={
              <>
                <Play className="h-4 w-4" />
                Set up test
              </>
            }
            variant="signal"
          />
          <ActionCard
            number="02"
            href="/bank"
            eyebrow="Question bank"
            title="Edit the bank"
            body="Tune stems, choices and topics — get the questions right before the next test."
            cta={
              <>
                <BookOpen className="h-4 w-4" />
                Open bank
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
    <div className="min-w-0 lg:px-6 lg:first:pl-0">
      <div className="flex items-center gap-1.5 text-muted">
        {icon}
        <span className="text-xs font-medium">
          {label}
        </span>
      </div>
      <div className={`mt-3 digit text-3xl font-medium ${color}`}>{value}</div>
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
    <div className="min-w-0 py-1">
      <div className="text-xs capitalize text-muted">{label}</div>
      <div className={`mt-1 font-mono text-sm tabular ${color}`}>{value}</div>
    </div>
  );
}

function ActionCard({
  number,
  href,
  eyebrow,
  title,
  body,
  cta,
  variant = "outline",
}: {
  number: string;
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
      className="panel panel-hover stripe-in group relative block overflow-hidden p-6 sm:p-7"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">{eyebrow}</p>
        <span aria-hidden="true" className="font-mono text-xs text-muted">/{number}</span>
      </div>
      <h3 className="mt-4 text-xl font-medium tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-foreground-dim">{body}</p>
      <div className="mt-5">
          <span className={`inline-flex items-center gap-2 text-sm font-medium ${variant === "signal" ? "text-signal" : "text-foreground"}`}>
            {cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
      </div>
    </Link>
  );
}
