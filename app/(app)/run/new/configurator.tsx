"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Play, AlertTriangle } from "lucide-react";

type LectureChoice = { id: string; name: string; slug: string; count: number };

const DEFAULT_REAL_EXAM_MIN = 90; // assumed Exam Pod default; configurable per-run
const DEFAULT_PRESSURE_DELTA_MIN = 10;

export function Configurator({ lectures }: { lectures: LectureChoice[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(lectures.map((l) => [l.id, true])),
  );
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
      <Card>
        <CardHeader>
          <CardTitle>Run setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Lectures</Label>
            <ul className="space-y-1.5">
              {lectures.map((l) => {
                const disabled = l.count === 0;
                const checked = !!selected[l.id] && !disabled;
                return (
                  <li key={l.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 py-2",
                        disabled && "opacity-50 cursor-not-allowed",
                        checked && "border-signal/60 bg-signal/5",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="accent-signal"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [l.id]: e.target.checked }))
                        }
                      />
                      <span className="flex-1 text-sm text-foreground">{l.name}</span>
                      <Badge tone={l.count === 0 ? "warn" : "neutral"}>
                        {l.count} Q
                      </Badge>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Real exam duration (min)</Label>
              <Input
                type="number"
                min={5}
                max={300}
                value={realMin}
                onChange={(e) => setRealMin(Math.max(5, Number(e.target.value) || 0))}
              />
              <p className="text-[11px] text-muted">
                Mirror the official Exam Pod limit.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Pressure reduction (min)</Label>
              <Input
                type="number"
                min={0}
                max={realMin - 1}
                value={pressureDeltaMin}
                onChange={(e) =>
                  setPressureDeltaMin(Math.max(0, Number(e.target.value) || 0))
                }
              />
              <p className="text-[11px] text-muted">
                Shaved off the real timer. Doctrine: train under worse conditions than
                the race.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Max questions (optional)</Label>
              <Input
                type="number"
                min={1}
                value={maxQuestions}
                placeholder={`all available (${availableQuestions})`}
                onChange={(e) => setMaxQuestions(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Label (optional)</Label>
              <Input
                value={label}
                maxLength={120}
                placeholder='e.g. "midblock pacing run #3"'
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Shuffling</Label>
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
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-bad/40 bg-bad/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-bad" />
              <p className="text-bad/90">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Pressure brief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Lectures" value={`${selectedLectures.length} selected`} />
            <Row
              label="Questions"
              value={`${targetCount}${
                maxQuestions && availableQuestions > targetCount
                  ? ` (of ${availableQuestions})`
                  : ""
              }`}
            />
            <Row label="Real exam" value={`${realMin} min`} />
            <Row
              label="Pod timer"
              value={
                <span className="font-mono tabular text-signal">
                  {effectiveMin} min
                </span>
              }
            />
            <Row
              label="Per-Q budget"
              value={
                targetCount > 0
                  ? `${Math.round((effectiveMs / targetCount / 1000) * 10) / 10}s`
                  : "—"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lockdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted">
            <Line>Fullscreen required to start.</Line>
            <Line>Tab blur / exit fullscreen = integrity flag.</Line>
            <Line>Copy/paste, right-click, and reload blocked.</Line>
            <Line>
              <span className="text-bad">2 flags → auto-submit and abort.</span>
            </Line>
            <Line>Timer hitting zero auto-submits.</Line>
          </CardContent>
        </Card>

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
        <p className="text-center text-[10px] uppercase tracking-[0.18em] text-muted">
          You will lose the AppShell once inside.
        </p>
      </div>
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
        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
        checked
          ? "border-signal/60 bg-signal/10 text-signal"
          : "border-border-strong bg-surface text-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-1 inline-block h-1 w-1 rounded-full bg-signal" />
      <span>{children}</span>
    </div>
  );
}
