import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDebrief, selectWeakAreas, type SectorRow, type WrongAnswer } from "@/lib/debrief";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuestionContent } from "@/components/question-content";
import { DeleteAttemptButton } from "@/components/delete-attempt-button";
import { formatDuration } from "@/lib/utils";
import {
  ChevronLeft,
  Target,
  AlertCircle,
  Repeat,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { WeakAreaRetryButton } from "./retry-actions";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
export const dynamic = "force-dynamic";
export const metadata = { title: "Debrief — WilliamsPod" };

export default async function DebriefPage(
  props: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await props.params;
  const debrief = await loadDebrief(attemptId);
  if (!debrief) notFound();

  const {
    attempt,
    totals,
    bySector,
    byTopic,
    weakestSector,
    weakestTopic,
    wrongAnswers,
    integrityTimeline,
  } = debrief;
  const weak = selectWeakAreas(debrief);

  const tone: "good" | "warn" | "bad" | "neutral" =
    totals.pct >= 80 ? "good" : totals.pct >= 60 ? "neutral" : totals.pct >= 40 ? "warn" : "bad";

  const scoreColor =
    tone === "good"
      ? "text-good"
      : tone === "warn"
        ? "text-warn"
        : tone === "bad"
          ? "text-bad"
          : "text-foreground";

  return (
    <div className="space-y-10">
      <Link
        href="/run"
        className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-muted hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> Runs
      </Link>

      {/* ----- HERO ----- */}
      <section className="relative overflow-hidden panel-deep p-8 pop-in">
        <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-40" />
        <div
          className={`pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full blur-3xl ${
            tone === "good"
              ? "bg-good/12"
              : tone === "bad"
                ? "bg-bad/12"
                : tone === "warn"
                  ? "bg-warn/12"
                  : "bg-signal/8"
          }`}
        />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className={`dot ${scoreColor}`} />
              <p className="eyebrow">Debrief</p>
              {attempt.aborted && <Badge tone="bad">Aborted</Badge>}
            </div>
            <h1 className="mt-2 display-lg text-foreground">
              {attempt.label ?? "Pod run"}
            </h1>
            <p className="mt-2 text-sm text-foreground-dim">
              {new Date(attempt.startedAt).toLocaleString()} ·{" "}
              {formatDuration(attempt.timeUsedMs ?? 0)} of{" "}
              {formatDuration(attempt.durationMs)}
              {totals.unanswered > 0 && ` · ${totals.unanswered} unanswered`}
            </p>

            <div className="mt-8 flex items-baseline gap-3">
              <span className={`digit display-xl ${scoreColor}`}>
                {totals.pct.toFixed(0)}
              </span>
              <span className="digit text-3xl text-muted">%</span>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="digit text-xl text-foreground-dim">
                {totals.correct}/{totals.total}
              </span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted">
                correct
              </span>
            </div>
          </div>

          {/* Right column: quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <BigTile
              label="Time used"
              value={formatDuration(attempt.timeUsedMs ?? 0)}
              sub={`/${formatDuration(attempt.durationMs)}`}
            />
            <BigTile
              label="Integrity"
              value={String(attempt.integrityFlagCount)}
              sub={attempt.integrityFlagCount > 0 ? "flags" : "clean"}
              tone={attempt.integrityFlagCount > 0 ? "warn" : "good"}
            />
            <BigTile
              label="Correct"
              value={String(totals.correct)}
              sub={`/${totals.total}`}
              tone="good"
            />
            <BigTile
              label="Wrong"
              value={String(totals.total - totals.correct)}
              sub={totals.unanswered > 0 ? `incl ${totals.unanswered} blank` : ""}
              tone={totals.total - totals.correct > 0 ? "bad" : undefined}
            />
          </div>
        </div>

        <div className="relative mt-8 flex flex-wrap items-center gap-2 border-t border-border pt-6">
          <WeakAreaRetryButton
            attemptId={attemptId}
            durationMs={attempt.durationMs}
            weakLectureIds={weak.lectureIds}
            allLectureIds={attempt.lectureIds}
          />
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href="/run/new">
              New run
            </Link>
          </Button>
          <DeleteAttemptButton
            attemptId={attemptId}
            label={attempt.label ?? "Pod run"}
            redirectTo="/run"
          />
        </div>
      </section>

      {/* ----- TELEMETRY ----- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <SectorCard
          title="Sector telemetry"
          subtitle="By lecture"
          rows={bySector}
          weakKey={weakestSector?.key}
        />
        <SectorCard
          title="Topic telemetry"
          subtitle="By tag"
          rows={
            byTopic.length === 1 && byTopic[0].name === "Untagged" ? [] : byTopic
          }
          weakKey={weakestTopic?.key}
          emptyHint='Tag questions with a "topic" column to unlock topic telemetry.'
        />
      </section>

      {/* ----- WEAKEST CARDS ----- */}
      {(weakestSector || (weakestTopic && weakestTopic.name !== "Untagged")) && (
        <section className="grid gap-4 lg:grid-cols-2">
          {weakestSector && (
            <WeakestCard
              icon={<Target className="h-3.5 w-3.5" />}
              kind="Weakest lecture"
              name={weakestSector.name}
              correct={weakestSector.correct}
              total={weakestSector.total}
              pct={weakestSector.pct}
              hint="Recommend reviewing this lecture before next run."
            />
          )}
          {weakestTopic && weakestTopic.name !== "Untagged" && (
            <WeakestCard
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              kind="Weakest topic"
              name={weakestTopic.name}
              correct={weakestTopic.correct}
              total={weakestTopic.total}
              pct={weakestTopic.pct}
              hint="Drill this concept across lectures."
            />
          )}
        </section>
      )}

      {/* ----- INTEGRITY TIMELINE ----- */}
      {integrityTimeline.length > 0 && (
        <section className="panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-warn" />
              <p className="eyebrow text-warn">Integrity timeline</p>
            </div>
            <Badge tone="warn">{integrityTimeline.length} events</Badge>
          </div>
          <ol className="space-y-1.5">
            {integrityTimeline.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 border-b border-border/60 pb-1.5 last:border-0"
              >
                <span className="w-20 font-mono tabular text-xs text-muted">
                  +{formatDuration(e.elapsedMs)}
                </span>
                <Badge tone="warn">{e.kind.replace(/_/g, " ")}</Badge>
                {e.detail && (
                  <span className="font-mono text-[11px] text-muted">{e.detail}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ----- WRONG-ANSWER REVIEW ----- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-bad" />
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Wrong-answer review
            </h2>
          </div>
          <Badge tone={wrongAnswers.length === 0 ? "good" : "bad"}>
            {wrongAnswers.length} of {totals.total}
          </Badge>
        </div>
        {wrongAnswers.length === 0 ? (
          <div className="panel flex items-center gap-3 p-6">
            <CheckCircle2 className="h-5 w-5 text-good" />
            <p className="text-sm text-foreground">
              Clean run. No wrong answers to review.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {wrongAnswers.map((w, i) => (
              <WrongRow key={w.questionId} q={w} index={i} />
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between border-t border-border pt-6">
        <Button asChild variant="outline">
          <Link href="/run">
            <ChevronLeft className="h-4 w-4" />
            Back to runs
          </Link>
        </Button>
        <Button asChild variant="signal">
          <Link href="/run/new">
            <Repeat className="h-4 w-4" />
            New run
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function BigTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
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
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`digit text-2xl ${color}`}>{value}</span>
        {sub && (
          <span className="font-mono text-[11px] tabular text-muted">{sub}</span>
        )}
      </div>
    </div>
  );
}

function SectorCard({
  title,
  subtitle,
  rows,
  weakKey,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  rows: SectorRow[];
  weakKey: string | undefined;
  emptyHint?: string;
}) {
  return (
    <div className="panel p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow">{title}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-strong">
            {subtitle}
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{emptyHint ?? "No data."}</p>
      ) : (
        <SectorBars rows={rows} weakKey={weakKey} />
      )}
    </div>
  );
}

function SectorBars({
  rows,
  weakKey,
}: {
  rows: SectorRow[];
  weakKey: string | undefined;
}) {
  return (
    <ul className="space-y-4">
      {rows.map((r, i) => {
        const isWeak = r.key === weakKey;
        const tone =
          r.pct >= 80 ? "good" : r.pct >= 60 ? "signal" : r.pct >= 40 ? "warn" : "bad";
        const colorClass =
          tone === "good"
            ? "bg-good"
            : tone === "signal"
              ? "bg-signal"
              : tone === "warn"
                ? "bg-warn"
                : "bg-bad";
        const textColor =
          tone === "good"
            ? "text-good"
            : tone === "signal"
              ? "text-signal"
              : tone === "warn"
                ? "text-warn"
                : "text-bad";
        const glow =
          tone === "good"
            ? "shadow-[0_0_10px_-2px_rgba(78,194,127,0.5)]"
            : tone === "signal"
              ? "shadow-[0_0_10px_-2px_rgba(45,212,241,0.5)]"
              : tone === "warn"
                ? "shadow-[0_0_10px_-2px_rgba(233,176,51,0.5)]"
                : "shadow-[0_0_10px_-2px_rgba(239,83,80,0.5)]";
        return (
          <li key={r.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-foreground">{r.name}</span>
                {isWeak && <Badge tone="bad">weakest</Badge>}
              </div>
              <div className="flex shrink-0 items-baseline gap-2 text-xs">
                <span className={`digit text-sm ${textColor}`}>{r.pct}%</span>
                <span className="font-mono tabular text-muted">
                  {r.correct}/{r.total}
                </span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-border">
              <div
                className={`h-full rounded-full bar-sweep ${colorClass} ${glow}`}
                style={{
                  width: `${r.pct}%`,
                  animationDelay: `${i * 60}ms`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function WeakestCard({
  icon,
  kind,
  name,
  correct,
  total,
  pct,
  hint,
}: {
  icon: React.ReactNode;
  kind: string;
  name: string;
  correct: number;
  total: number;
  pct: number;
  hint: string;
}) {
  return (
    <div className="panel border-bad/30 p-6">
      <div className="flex items-center gap-2 text-bad">
        {icon}
        <p className="eyebrow text-bad">{kind}</p>
      </div>
      <p className="mt-3 text-xl font-semibold text-foreground">{name}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="digit text-2xl text-bad">{pct}%</span>
        <span className="font-mono text-xs tabular text-muted">
          {correct}/{total}
        </span>
      </div>
      <p className="mt-4 text-xs text-foreground-dim">{hint}</p>
    </div>
  );
}

function WrongRow({ q, index }: { q: WrongAnswer; index: number }) {
  const picked = q.pickedSourceIndex;
  return (
    <article
      className="panel pop-in p-5"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
        <span className="digit text-foreground">
          Q{String(q.questionOrder + 1).padStart(3, "0")}
        </span>
        {q.lectureName && <Badge tone="neutral">{q.lectureName}</Badge>}
        {q.topic && <Badge tone="signal">{q.topic}</Badge>}
        {q.marked && <Badge tone="warn">marked</Badge>}
        {picked === -1 && <Badge tone="bad">unanswered</Badge>}
      </div>
      <QuestionContent
        content={q.stem}
        className="mt-4 text-[15px] leading-relaxed text-foreground"
        imageClassName="max-w-3xl"
      />
      <ul className="mt-4 space-y-1.5 text-sm">
        {q.choices.map((c, i) => {
          const isCorrect = i === q.correctIndex;
          const isPicked = i === picked;
          return (
            <li
              key={i}
              className={
                "flex items-start gap-3 rounded-md border px-3 py-2 " +
                (isCorrect
                  ? "border-good/40 bg-good-soft text-good"
                  : isPicked
                    ? "border-bad/40 bg-bad-soft text-bad"
                    : "border-transparent text-muted")
              }
            >
              <span className="mt-0.5 w-5 font-mono tabular text-[11px]">
                {LETTERS[i]}.
              </span>
              <span className="flex-1 text-foreground-dim">{c}</span>
              {isCorrect && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-good">
                  correct
                </span>
              )}
              {isPicked && !isCorrect && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-bad">
                  your pick
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {q.explanation && (
        <div className="mt-4 rounded-md border border-signal/25 bg-signal-soft p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-signal">
            Why
          </p>
          <QuestionContent
            content={q.explanation}
            className="mt-1.5 text-xs leading-relaxed text-foreground-dim"
            imageClassName="max-w-2xl"
          />
        </div>
      )}
    </article>
  );
}
