"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Play,
  AlertTriangle,
  ChevronsRight,
  Gauge,
  Timer,
  Shuffle,
} from "lucide-react";

type LectureChoice = {
  id: string;
  name: string;
  slug: string;
  subject: string | null;
  count: number;
};

const DEFAULT_REAL_EXAM_MIN = 90;
const DEFAULT_PRESSURE_DELTA_MIN = 10;
const UNGROUPED = "Other";

function ltNumber(name: string): number {
  const m = name.match(/^LT(\d+)/);
  return m ? Number(m[1]) : 9999;
}

export function Configurator({ lectures }: { lectures: LectureChoice[] }) {
  const router = useRouter();
  // Default: nothing selected — user picks subject(s) deliberately.
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [realMin, setRealMin] = useState(DEFAULT_REAL_EXAM_MIN);
  const [pressureDeltaMin, setPressureDeltaMin] = useState(DEFAULT_PRESSURE_DELTA_MIN);
  const [maxQuestions, setMaxQuestions] = useState<string>("");
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleChoices, setShuffleChoices] = useState(true);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLectures = useMemo(
    () => lectures.filter((l) => selected[l.id] && l.count > 0),
    [lectures, selected],
  );
  const availableQuestions = useMemo(
    () => selectedLectures.reduce((s, l) => s + l.count, 0),
    [selectedLectures],
  );

  const effectiveMin = Math.max(1, realMin - pressureDeltaMin);
  const effectiveMs = effectiveMin * 60_000;

  const targetCount = (() => {
    const n = Number(maxQuestions);
    if (!maxQuestions) return availableQuestions;
    if (!Number.isFinite(n) || n < 1) return availableQuestions;
    return Math.min(n, availableQuestions);
  })();

  const perQSec =
    targetCount > 0 ? Math.round((effectiveMs / targetCount / 1000) * 10) / 10 : 0;

  function selectAll() {
    setSelected(Object.fromEntries(lectures.map((l) => [l.id, l.count > 0])));
  }
  function clearAll() {
    setSelected({});
  }

  // Group lectures by subject for the picker.
  const groups = useMemo(() => {
    const m = new Map<string, LectureChoice[]>();
    for (const l of lectures) {
      const key = l.subject?.trim() || UNGROUPED;
      const arr = m.get(key) ?? [];
      arr.push(l);
      m.set(key, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const an = ltNumber(a.name);
        const bn = ltNumber(b.name);
        if (an !== bn) return an - bn;
        return a.name.localeCompare(b.name);
      });
    }
    return m;
  }, [lectures]);

  const groupOrder = useMemo(() => {
    return Array.from(groups.keys()).sort((a, b) => {
      if (a === UNGROUPED) return 1;
      if (b === UNGROUPED) return -1;
      return a.localeCompare(b);
    });
  }, [groups]);

  function selectGroup(subject: string) {
    const items = groups.get(subject) ?? [];
    setSelected((prev) => {
      const next = { ...prev };
      for (const l of items) {
        if (l.count > 0) next[l.id] = true;
      }
      return next;
    });
  }
  function clearGroup(subject: string) {
    const items = groups.get(subject) ?? [];
    setSelected((prev) => {
      const next = { ...prev };
      for (const l of items) next[l.id] = false;
      return next;
    });
  }
  function groupSelectionState(subject: string): "none" | "some" | "all" {
    const items = (groups.get(subject) ?? []).filter((l) => l.count > 0);
    if (items.length === 0) return "none";
    const sel = items.filter((l) => selected[l.id]).length;
    if (sel === 0) return "none";
    if (sel === items.length) return "all";
    return "some";
  }

  async function start() {
    setError(null);
    if (selectedLectures.length === 0) {
      setError("Pick at least one lecture.");
      return;
    }
    if (availableQuestions === 0) {
      setError("Selected lectures have no questions.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "custom",
          lectureIds: selectedLectures.map((l) => l.id),
          durationMs: effectiveMs,
          maxQuestions: maxQuestions ? targetCount : undefined,
          label: label || undefined,
          shuffleQuestions,
          shuffleChoices,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `Could not create run (${res.status})`);
        return;
      }
      router.push(`/pod/${json.attemptId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {/* ---------- Lectures ---------- */}
        <section className="panel p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Lectures</p>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                All
              </Button>
              <span className="text-muted">·</span>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                None
              </Button>
            </div>
          </div>

          <div className="space-y-5">
            {groupOrder.map((subject) => {
              const items = groups.get(subject)!;
              const state = groupSelectionState(subject);
              const counts = items.reduce(
                (acc, l) => {
                  if (selected[l.id]) {
                    acc.sel++;
                    acc.q += l.count;
                  }
                  acc.total++;
                  return acc;
                },
                { sel: 0, total: 0, q: 0 },
              );
              return (
                <div key={subject} className="space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`dot ${
                          subject === UNGROUPED
                            ? "text-muted"
                            : state === "all"
                              ? "text-signal"
                              : state === "some"
                                ? "text-warn"
                                : "text-muted"
                        }`}
                      />
                      <h3
                        className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${
                          subject === UNGROUPED
                            ? "text-muted"
                            : "text-foreground-dim"
                        }`}
                      >
                        {subject}
                      </h3>
                      <span className="font-mono text-[10px] tabular text-muted">
                        {counts.sel}/{counts.total}
                        {counts.sel > 0 && ` · ${counts.q} Q`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectGroup(subject)}
                      >
                        All
                      </Button>
                      <span className="text-muted">·</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearGroup(subject)}
                      >
                        None
                      </Button>
                    </div>
                  </div>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {items.map((l) => {
                      const disabled = l.count === 0;
                      const checked = !!selected[l.id] && !disabled;
                      return (
                        <li key={l.id}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                              disabled && "cursor-not-allowed opacity-40",
                              checked
                                ? "border-signal/60 bg-signal-soft text-foreground"
                                : "border-border bg-surface-2 text-foreground-dim hover:border-border-bright hover:text-foreground",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="accent-signal"
                              checked={checked}
                              disabled={disabled}
                              onChange={(e) =>
                                setSelected((s) => ({
                                  ...s,
                                  [l.id]: e.target.checked,
                                }))
                              }
                            />
                            <span className="flex-1 truncate text-sm">
                              {l.name}
                            </span>
                            <Badge
                              tone={disabled ? "warn" : checked ? "signal" : "neutral"}
                            >
                              {l.count} Q
                            </Badge>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------- Timing ---------- */}
        <section className="panel p-6">
          <div className="mb-5 flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-signal" />
            <p className="eyebrow">Timing</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              label="Real exam (min)"
              hint="Mirror the official Exam Pod limit."
              value={realMin}
              onChange={(v) => setRealMin(Math.max(5, v))}
              min={5}
              max={300}
            />
            <NumberField
              label="Pressure shave (min)"
              hint="Doctrine: train under worse conditions than the race."
              value={pressureDeltaMin}
              onChange={(v) => setPressureDeltaMin(Math.max(0, v))}
              min={0}
              max={Math.max(0, realMin - 1)}
            />
          </div>

          {/* visual: real -> pod */}
          <div className="mt-6 rounded-md border border-border bg-surface-2 p-4">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted">
              <span>Real</span>
              <span className="flex items-center gap-1 text-signal">
                <ChevronsRight className="h-3 w-3" />
                Pod timer
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <span className="digit text-2xl text-foreground-dim">
                {realMin}
                <span className="text-sm text-muted"> min</span>
              </span>
              <div className="flex flex-1 items-center px-3">
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="absolute inset-y-0 left-0 bg-signal shadow-[0_0_8px_-1px_rgba(45,212,241,0.6)] transition-[width]"
                    style={{
                      width: `${Math.max(5, (effectiveMin / Math.max(1, realMin)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <span className="digit text-2xl text-signal">
                {effectiveMin}
                <span className="text-sm text-muted"> min</span>
              </span>
            </div>
            <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-muted">
              −{pressureDeltaMin} min vs real
            </p>
          </div>
        </section>

        {/* ---------- Scope ---------- */}
        <section className="panel p-6">
          <div className="mb-5 flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-signal" />
            <p className="eyebrow">Scope</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Max questions (optional)</Label>
              <Input
                type="number"
                min={1}
                value={maxQuestions}
                placeholder={`all available (${availableQuestions})`}
                onChange={(e) => setMaxQuestions(e.target.value)}
              />
              <p className="text-[11px] text-muted">
                Cap the run shorter than the bank.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Label (optional)</Label>
              <Input
                value={label}
                maxLength={120}
                placeholder='"midblock pacing run #3"'
                onChange={(e) => setLabel(e.target.value)}
              />
              <p className="text-[11px] text-muted">
                Shows in run history.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Shuffle ---------- */}
        <section className="panel p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shuffle className="h-3.5 w-3.5 text-signal" />
            <p className="eyebrow">Shuffling</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Toggle
              checked={shuffleQuestions}
              onChange={setShuffleQuestions}
              label="Shuffle questions"
            />
            <Toggle
              checked={shuffleChoices}
              onChange={setShuffleChoices}
              label="Shuffle answer choices"
            />
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-bad/40 bg-bad-soft p-3 text-sm pop-in">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-bad" />
            <p className="text-bad/90">{error}</p>
          </div>
        )}
      </div>

      {/* ---------- Right column: pressure brief ---------- */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="panel-deep p-5">
          <div className="flex items-center gap-2">
            <span className="dot text-signal pod-pulse" />
            <p className="eyebrow">Pressure brief</p>
          </div>

          <div className="mt-5 space-y-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
              Pod timer
            </p>
            <div className="flex items-baseline gap-2">
              <span className="digit display-lg text-signal">{effectiveMin}</span>
              <span className="text-sm text-muted">min</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <BriefTile label="Questions" value={String(targetCount)} />
            <BriefTile
              label="Per Q"
              value={perQSec > 0 ? `${perQSec}s` : "—"}
              tone={perQSec > 0 && perQSec < 45 ? "warn" : undefined}
            />
            <BriefTile
              label="Lectures"
              value={String(selectedLectures.length)}
            />
            <BriefTile label="Real exam" value={`${realMin}m`} sub="vs" />
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center gap-2 text-bad">
            <AlertTriangle className="h-3.5 w-3.5" />
            <p className="eyebrow text-bad">Lockdown</p>
          </div>
          <ul className="mt-4 space-y-2 text-xs text-foreground-dim">
            <LockLine>Fullscreen engages where supported.</LockLine>
            <LockLine>Leaving the app triggers an integrity flag.</LockLine>
            <LockLine>Copy/paste, right-click, reload blocked.</LockLine>
            <LockLine accent>
              2 flags → auto-submit and abort.
            </LockLine>
            <LockLine>Timer hitting zero auto-submits.</LockLine>
          </ul>
        </div>

        <Button
          variant="signal"
          size="lg"
          className="w-full"
          onClick={start}
          disabled={busy || availableQuestions === 0}
        >
          <Play className="h-4 w-4" />
          {busy ? "Spinning up pod…" : "Enter pod"}
        </Button>
        <p className="text-center text-[10px] uppercase tracking-[0.22em] text-muted">
          No way back once armed
        </p>
      </aside>
    </div>
  );
}

// ----------------------------------------------------------------------------

function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="font-mono"
      />
      <p className="text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "rounded-md border px-3.5 py-2 text-xs font-medium transition-all",
        checked
          ? "border-signal/60 bg-signal-soft text-signal shadow-[inset_0_1px_0_0_rgba(45,212,241,0.18)]"
          : "border-border-strong bg-surface-2 text-muted-strong hover:border-border-bright hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function BriefTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn" | "bad";
}) {
  const color =
    tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-surface-2 p-2.5">
      <p className="text-[9px] uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`digit text-base ${color}`}>{value}</span>
        {sub && <span className="text-[9px] text-muted">{sub}</span>}
      </div>
    </div>
  );
}

function LockLine({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={cn(
          "mt-1.5 inline-block h-1 w-1 rounded-full",
          accent ? "bg-bad" : "bg-signal",
        )}
      />
      <span className={accent ? "text-bad" : ""}>{children}</span>
    </li>
  );
}
