import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadStandings, type StandingRow } from "@/lib/mastery/store";
import { loadWeakConcepts, type WeakConcept } from "@/lib/review/concepts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecommendedTestButton } from "@/components/recommended-test-button";
import { Trophy, Flag, TrendingUp, TrendingDown, Minus, Target } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Progress — WilliamsPod" };

export default async function StandingsPage() {
  const user = await requireUser();
  const [{ subjects, topics }, weakConcepts] = await Promise.all([
    loadStandings(user.id),
    loadWeakConcepts(user.id),
  ]);

  if (subjects.length === 0) {
    return (
      <div className="space-y-8">
        <Header />
        <div className="panel flex flex-col items-center gap-3 py-14 text-center">
          <Trophy className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">
            No progress yet. Every test you finish updates a rating per subject —
            take one to get started.
          </p>
          <Button asChild variant="signal" className="mt-2">
            <Link href="/run/new">
              <Flag className="h-4 w-4" />
              New test
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const leader = subjects[0];

  return (
    <div className="space-y-8">
      <Header />

      {/* Leader spotlight */}
      <section className="panel-deep relative overflow-hidden p-6 pop-in">
        <div className="livery-stripe pointer-events-none absolute inset-x-0 top-0 h-[3px]" />
        <p className="eyebrow">Top subject</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="roundel h-12 w-12 text-xl" aria-hidden="true">
              1
            </span>
            <div>
              <h2 className="display-lg text-foreground">{leader.key}</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                {leader.races} test{leader.races === 1 ? "" : "s"} ·{" "}
                {leader.accuracy}% accuracy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Sparkline history={leader.history} className="h-10 w-32" />
            <div className="text-right">
              <div className="digit text-4xl text-signal">{leader.rating}</div>
              <DeltaChip delta={leader.lastDelta} />
            </div>
          </div>
        </div>
      </section>

      {/* Subject standings */}
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="eyebrow">By subject</p>
          <Trophy className="h-3.5 w-3.5 text-signal" />
        </div>
        <ul className="divide-y divide-border">
          {subjects.map((row, i) => (
            <StandingLine key={row.key} pos={i + 1} row={row} />
          ))}
        </ul>
      </section>

      {/* Topic standings (only when tagged) */}
      {topics.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="eyebrow">By topic</p>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {topics.length} tracked
            </span>
          </div>
          <ul className="divide-y divide-border">
            {topics.slice(0, 20).map((row, i) => (
              <StandingLine key={row.key} pos={i + 1} row={row} compact />
            ))}
          </ul>
        </section>
      )}

      {/* Concepts to review — cross-test weak concepts */}
      {weakConcepts.length > 0 && (
        <section className="panel p-6">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-signal" />
              <p className="eyebrow">Concepts to review</p>
            </div>
            <RecommendedTestButton size="sm" label="Review these" />
          </div>
          <p className="mb-5 max-w-2xl text-[11px] leading-relaxed text-muted">
            Ideas you keep missing across tests, however they&apos;re framed —
            ranked by how often. A review test targets these first.
          </p>
          <ul className="space-y-3">
            {weakConcepts.map((c) => (
              <ConceptRow key={c.concept} concept={c} />
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-[10px] uppercase tracking-[0.22em] text-muted">
        Ratings start at 1000 · harder questions are worth more
      </p>
    </div>
  );
}

function ConceptRow({ concept }: { concept: WeakConcept }) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-bold text-foreground">
            {concept.concept}
          </span>
          {concept.subjects.length > 0 && (
            <span className="hidden shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted sm:inline">
              {concept.subjects.join(" · ")}
            </span>
          )}
        </div>
        <span className="shrink-0 font-mono tabular text-xs text-muted">
          <span className="text-bad">{concept.wrong}</span> missed / {concept.total}{" "}
          · {concept.missRate}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-border">
        <div
          className="h-full rounded-full bg-bad"
          style={{ width: `${Math.min(100, concept.missRate)}%` }}
        />
      </div>
    </li>
  );
}

function Header() {
  return (
    <header>
      <div className="flex items-center gap-2">
        <span className="dot text-signal" />
        <p className="eyebrow">Progress</p>
      </div>
      <h1 className="mt-2 display-lg text-foreground">
        Your <span className="race-lean text-signal">progress</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground-dim">
        A rating per subject and topic that updates after every test — so you can
        see whether you&apos;re actually improving, not just how one test went.
      </p>
    </header>
  );
}

function StandingLine({
  pos,
  row,
  compact,
}: {
  pos: number;
  row: StandingRow;
  compact?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <span className="w-8 shrink-0 text-center">
        <span
          className={
            pos <= 3
              ? "digit text-sm font-bold text-signal"
              : "digit text-sm text-muted"
          }
        >
          P{pos}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-foreground">{row.key}</span>
          {row.rusty && (
            <span
              className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em] text-warn"
              title="Rating has faded from lack of practice — review to recover it"
            >
              rusty
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted">
          {row.races} test{row.races === 1 ? "" : "s"} · {row.correct}/
          {row.answered} · {row.accuracy}%
        </div>
      </div>
      {!compact && (
        <Sparkline history={row.history} className="hidden h-8 w-24 sm:block" />
      )}
      <DeltaChip delta={row.lastDelta} />
      <div className="w-14 shrink-0 text-right digit text-base font-bold text-foreground">
        {row.rating}
      </div>
    </li>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <Badge tone="neutral" className="gap-1">
        <Minus className="h-2.5 w-2.5" />0
      </Badge>
    );
  }
  const up = delta > 0;
  return (
    <Badge tone={up ? "good" : "bad"} className="gap-1">
      {up ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      {up ? "+" : ""}
      {delta}
    </Badge>
  );
}

function Sparkline({
  history,
  className,
}: {
  history: { at: string; rating: number }[];
  className?: string;
}) {
  if (history.length < 2) {
    return <div className={className} aria-hidden="true" />;
  }
  const values = history.map((h) => h.rating);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const W = 100;
  const H = 32;
  const step = W / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = H - ((v - min) / span) * (H - 4) - 2;
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");
  const rising = values[values.length - 1] >= values[0];
  const stroke = rising ? "var(--good)" : "var(--bad)";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-label="rating trend"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
