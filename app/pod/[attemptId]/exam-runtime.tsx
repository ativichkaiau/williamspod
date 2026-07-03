"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  ShieldAlert,
  Hourglass,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDuration } from "@/lib/utils";
import { QuestionContent } from "@/components/question-content";

type RuntimeQuestion = {
  id: string;
  stem: string;
  displayChoices: string[];
  /** Advisory adaptive time budget (seconds), or null. */
  recommendedSec?: number | null;
  type?: string | null;
};

type Props = {
  attemptId: string;
  durationMs: number;
  startedAtMs: number;
  questions: RuntimeQuestion[];
  initialPicks: Record<string, number>;
  initialMarked: Record<string, boolean>;
};

type IntegrityKind =
  | "blur"
  | "visibility_hidden"
  | "fullscreen_exit"
  | "copy"
  | "paste"
  | "context_menu"
  | "nav_block"
  | "shortcut_block";

const ABORT_THRESHOLD = 2;
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const NOISY_INTEGRITY_KINDS = new Set<IntegrityKind>([
  "blur",
  "visibility_hidden",
  "fullscreen_exit",
]);
const INTEGRITY_CLUSTER_MS = 2500;

function isTouchLockdownBrowser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  const isIPadOSDesktopUA = touchPoints > 1 && ua.includes("Macintosh");
  const isIOS = /iPad|iPhone|iPod/.test(ua) || isIPadOSDesktopUA;
  const isCoarsePointer =
    window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return isIOS || (touchPoints > 0 && isCoarsePointer);
}

export function ExamRuntime({
  attemptId,
  durationMs,
  questions,
  initialPicks,
  initialMarked,
}: Props) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [examStartMs, setExamStartMs] = useState<number | null>(null);
  const [picks, setPicks] = useState<Record<string, number>>(initialPicks);
  const [marked, setMarked] = useState<Record<string, boolean>>(initialMarked);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [integrityCount, setIntegrityCount] = useState(0);
  const [integrityWarning, setIntegrityWarning] = useState<string | null>(null);
  const [abortReason, setAbortReason] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const touchLockdownRef = useRef(false);
  const lastNoisyIntegrityRef = useRef<{ kind: IntegrityKind; at: number } | null>(
    null,
  );

  // Pending diff to flush to server on nav/answer-change.
  const pendingPicksRef = useRef<Record<string, number>>({});
  const pendingMarkedRef = useRef<Record<string, boolean>>({});
  const lastFlushRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- Telemetry metrics (per question) ----------
  type Metrics = {
    clicks: number;
    changes: number;
    revisits: number;
    timeMs: number;
  };
  const metricsRef = useRef<Record<string, Metrics>>({});
  const enterRef = useRef<{ qid: string; at: number } | null>(null);
  const visitedRef = useRef<Set<string>>(new Set());
  const ensureMetrics = useCallback((qid: string): Metrics => {
    const m = metricsRef.current[qid] ?? {
      clicks: 0,
      changes: 0,
      revisits: 0,
      timeMs: 0,
    };
    metricsRef.current[qid] = m;
    return m;
  }, []);

  const totalMs = durationMs;
  const elapsedMs = examStartMs ? now - examStartMs : 0;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const overtime = examStartMs != null && elapsedMs > totalMs;

  const cur = questions[currentIdx];

  const answeredCount = useMemo(
    () => Object.values(picks).filter((p) => p >= 0).length,
    [picks],
  );
  const markedCount = useMemo(
    () => Object.values(marked).filter(Boolean).length,
    [marked],
  );

  // ---------- Flush state to server ----------
  const flushNow = useCallback(async () => {
    if (submittedRef.current) return;
    const picksToFlush = pendingPicksRef.current;
    const markedToFlush = pendingMarkedRef.current;
    if (
      Object.keys(picksToFlush).length === 0 &&
      Object.keys(markedToFlush).length === 0
    ) {
      return;
    }
    pendingPicksRef.current = {};
    pendingMarkedRef.current = {};
    lastFlushRef.current = Date.now();
    try {
      await fetch(`/api/attempts/${attemptId}/answers`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          picks: picksToFlush,
          marked: markedToFlush,
        }),
        keepalive: true,
      });
    } catch {
      // best-effort; the final submit will include current state too
    }
  }, [attemptId]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => flushNow(), 700);
  }, [flushNow]);

  // ---------- Submit ----------
  const submitAttempt = useCallback(
    async (opts?: { aborted?: boolean; reason?: string }) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      // Force a final flush before computing time.
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      const timeUsedMs = examStartMs ? Date.now() - examStartMs : 0;

      // Snapshot per-question interaction metrics (fold in the open item's time).
      const telemetry: Record<
        string,
        { timeTakenMs: number; clickCount: number; answerChangeCount: number; revisitCount: number }
      > = {};
      const openAdd = enterRef.current ? Date.now() - enterRef.current.at : 0;
      for (const q of questions) {
        const m = metricsRef.current[q.id];
        const extra = enterRef.current?.qid === q.id ? openAdd : 0;
        telemetry[q.id] = {
          timeTakenMs: (m?.timeMs ?? 0) + extra,
          clickCount: m?.clicks ?? 0,
          answerChangeCount: m?.changes ?? 0,
          revisitCount: m?.revisits ?? 0,
        };
      }

      try {
        const res = await fetch(`/api/attempts/${attemptId}/submit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            picks,
            marked,
            timeUsedMs,
            telemetry,
            aborted: !!opts?.aborted,
            abortReason: opts?.reason ?? null,
          }),
          keepalive: true,
        });
        if (res.ok) {
          // Try to exit fullscreen before we redirect, so the debrief renders cleanly.
          try {
            if (document.fullscreenElement) await document.exitFullscreen();
          } catch {
            /* ignore */
          }
          router.replace(`/run/${attemptId}/debrief`);
          router.refresh();
        } else {
          submittedRef.current = false;
          setSubmitting(false);
        }
      } catch {
        submittedRef.current = false;
        setSubmitting(false);
      }
    },
    [attemptId, picks, marked, examStartMs, router],
  );

  // ---------- Integrity events ----------
  const reportIntegrity = useCallback(
    async (kind: IntegrityKind, detail?: string) => {
      if (!armed || submittedRef.current) return;
      if (
        touchLockdownRef.current &&
        (kind === "blur" || kind === "fullscreen_exit")
      ) {
        return;
      }

      const eventAt = Date.now();
      if (NOISY_INTEGRITY_KINDS.has(kind)) {
        const last = lastNoisyIntegrityRef.current;
        if (last && eventAt - last.at < INTEGRITY_CLUSTER_MS) {
          lastNoisyIntegrityRef.current = { kind, at: eventAt };
          return;
        }
        lastNoisyIntegrityRef.current = { kind, at: eventAt };
      }

      const elapsed = examStartMs ? eventAt - examStartMs : 0;
      try {
        const res = await fetch(`/api/attempts/${attemptId}/integrity`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, elapsedMs: elapsed, detail: detail ?? null }),
          keepalive: true,
        });
        const j = (await res.json().catch(() => ({}))) as {
          total?: number;
          recorded?: boolean;
          shouldAbort?: boolean;
        };
        if (typeof j.total === "number") setIntegrityCount(j.total);
        if (j.recorded === false) return;
        setIntegrityWarning(
          `Integrity flag: ${humanizeKind(kind)} — ${j.total ?? "?"}/${ABORT_THRESHOLD}`,
        );
        if (j.shouldAbort) {
          setAbortReason(`integrity threshold reached (${j.total} flags)`);
          submitAttempt({
            aborted: true,
            reason: `integrity:${kind}`,
          });
        }
      } catch {
        // ignore
      }
    },
    [armed, attemptId, examStartMs, submitAttempt],
  );

  // ---------- Arm: enter fullscreen, start timer ----------
  const arm = useCallback(async () => {
    const isTouch = isTouchLockdownBrowser();
    touchLockdownRef.current = isTouch;
    try {
      const el = document.documentElement;
      if (!isTouch && el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
      }
    } catch {
      // Some browsers deny fullscreen; the run still arms and focus changes are tracked.
    }
    setExamStartMs(Date.now());
    setArmed(true);
  }, []);

  // ---------- Tick ----------
  useEffect(() => {
    if (!armed) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [armed]);

  // ---------- Auto-submit on timer expiry ----------
  useEffect(() => {
    if (!armed || submittedRef.current) return;
    if (remainingMs === 0) {
      const timeout = window.setTimeout(() => {
        submitAttempt({ aborted: false, reason: "time_expired" });
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [armed, remainingMs, submitAttempt]);

  // ---------- Lockdown wiring ----------
  useEffect(() => {
    if (!armed) return;

    const onBlur = () => reportIntegrity("blur");
    const onVis = () => {
      if (document.visibilityState === "hidden") reportIntegrity("visibility_hidden");
    };
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        reportIntegrity("fullscreen_exit");
      }
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      reportIntegrity("context_menu");
    };
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      reportIntegrity("copy");
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportIntegrity("paste");
    };
    const onKey = (e: KeyboardEvent) => {
      // Block reload / nav shortcuts.
      const k = e.key.toLowerCase();
      const blocked =
        (e.metaKey || e.ctrlKey) &&
        ["r", "w", "t", "n", "l", "p", "s", "f", "[", "]"].includes(k);
      if (blocked || k === "f5") {
        e.preventDefault();
        reportIntegrity("shortcut_block", `key:${e.key}`);
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // Force a final flush. Browser will still show its own native prompt.
      flushNow();
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [armed, reportIntegrity, flushNow]);

  // Dismiss the integrity flash banner after a few seconds.
  useEffect(() => {
    if (!integrityWarning) return;
    const id = setTimeout(() => setIntegrityWarning(null), 4500);
    return () => clearTimeout(id);
  }, [integrityWarning]);

  // ---------- Answer handlers ----------
  const pick = useCallback(
    (questionId: string, idx: number) => {
      const m = ensureMetrics(questionId);
      m.clicks += 1;
      setPicks((p) => {
        const prev = p[questionId];
        if (prev != null && prev >= 0 && prev !== idx) m.changes += 1;
        const next = { ...p, [questionId]: idx };
        pendingPicksRef.current = { ...pendingPicksRef.current, [questionId]: idx };
        return next;
      });
      scheduleFlush();
    },
    [scheduleFlush, ensureMetrics],
  );

  // Accumulate time-on-question and count revisits as the current item changes.
  useEffect(() => {
    if (!armed || !cur) return;
    const qid = cur.id;
    const m = ensureMetrics(qid);
    if (visitedRef.current.has(qid)) m.revisits += 1;
    visitedRef.current.add(qid);
    const enteredAt = Date.now();
    enterRef.current = { qid, at: enteredAt };
    return () => {
      m.timeMs += Date.now() - enteredAt;
    };
  }, [armed, cur, ensureMetrics]);

  const toggleMark = useCallback(
    (questionId: string) => {
      setMarked((m) => {
        const v = !m[questionId];
        const next = { ...m, [questionId]: v };
        pendingMarkedRef.current = { ...pendingMarkedRef.current, [questionId]: v };
        return next;
      });
      scheduleFlush();
    },
    [scheduleFlush],
  );

  // ---------- Keyboard navigation ----------
  // A-E to pick · ←/→ (or [/]) to nav · M to mark · Cmd/Ctrl+Enter to submit.
  // Modifier keys go through the integrity handler (which blocks Cmd+R etc.),
  // so this listener only fires on the plain shortcuts above. Skipped inside
  // text inputs (none in lockdown today, but future-proof).
  useEffect(() => {
    if (!armed || confirmSubmit || abortReason) return;
    const cur = questions[currentIdx];
    if (!cur) return;
    const choiceCount = cur.displayChoices.length;

    const onKeyNav = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // Cmd/Ctrl+Enter → open submit dialog
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        setConfirmSubmit(true);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k.length === 1) {
        const upper = k.toUpperCase();
        const idx = LETTERS.indexOf(upper);
        if (idx >= 0 && idx < choiceCount) {
          e.preventDefault();
          pick(cur.id, idx);
          return;
        }
        if (upper === "M") {
          e.preventDefault();
          toggleMark(cur.id);
          return;
        }
      }
      if (k === "ArrowLeft" || k === "[") {
        e.preventDefault();
        flushNow();
        setCurrentIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (k === "ArrowRight" || k === "]") {
        e.preventDefault();
        flushNow();
        setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
        return;
      }
    };

    document.addEventListener("keydown", onKeyNav);
    return () => document.removeEventListener("keydown", onKeyNav);
  }, [
    armed,
    confirmSubmit,
    abortReason,
    questions,
    currentIdx,
    pick,
    toggleMark,
    flushNow,
  ]);

  // ---------- Pre-arm splash ----------
  if (!armed) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-grid p-6">
        <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-40" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-signal/8 blur-3xl" />

        <div className="relative w-full max-w-xl pop-in">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="dot text-signal pod-pulse" />
              <p className="eyebrow">Pre-flight check</p>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
              Pod · armed when ready
            </div>
          </div>

          <div className="panel-deep p-8">
            <h1 className="display-lg text-foreground">
              Ready to enter the pod
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-foreground-dim">
              Timer starts when you arm. Fullscreen engages where supported. You
              can&apos;t rejoin a run mid-stream — treat this like the real exam.
            </p>

            <ul className="mt-6 space-y-3">
              <Spec
                label="Questions"
                value={String(questions.length)}
              />
              <Spec
                label="Pod timer"
                value={formatDuration(durationMs)}
                tone="signal"
              />
              <Spec
                label="Abort threshold"
                value={`${ABORT_THRESHOLD} flags → auto-submit`}
                tone="bad"
              />
            </ul>

            <div className="mt-7 flex items-center gap-3">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => router.replace("/run")}
              >
                Cancel
              </Button>
              <Button
                variant="signal"
                size="lg"
                className="flex-1"
                onClick={arm}
              >
                Arm pod &amp; start
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lockdown flex min-h-screen flex-col bg-grid">
      <TopBar
        remainingMs={remainingMs}
        totalMs={totalMs}
        answered={answeredCount}
        total={questions.length}
        marked={markedCount}
        integrityCount={integrityCount}
        overtime={overtime}
        onSubmit={() => setConfirmSubmit(true)}
      />

      {integrityWarning && (
        <div className="border-b border-bad/40 bg-bad-soft px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-bad pop-in flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5" />
          {integrityWarning}
        </div>
      )}

      <div className="grid flex-1 grid-cols-[1fr_260px] gap-6 px-6 py-6 max-md:grid-cols-1">
        <div className="space-y-6">
          <QuestionView
            index={currentIdx}
            total={questions.length}
            question={cur}
            picked={picks[cur.id] ?? -1}
            isMarked={!!marked[cur.id]}
            questionElapsedSec={Math.floor(
              ((metricsRef.current[cur.id]?.timeMs ?? 0) +
                (enterRef.current?.qid === cur.id ? now - enterRef.current.at : 0)) /
                1000,
            )}
            onPick={(i) => pick(cur.id, i)}
            onToggleMark={() => toggleMark(cur.id)}
          />
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <div className="flex flex-col items-center">
              <span className="text-[9px] uppercase tracking-[0.22em] text-muted">
                progress
              </span>
              <span className="digit text-sm text-foreground">
                {String(currentIdx + 1).padStart(2, "0")}
                <span className="text-muted">
                  /{String(questions.length).padStart(2, "0")}
                </span>
              </span>
            </div>
            <Button
              variant="signal"
              size="lg"
              onClick={() =>
                setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))
              }
              disabled={currentIdx === questions.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Navigator
          questions={questions}
          picks={picks}
          marked={marked}
          currentIdx={currentIdx}
          onJump={(i) => {
            flushNow();
            setCurrentIdx(i);
          }}
        />
      </div>

      <Dialog open={confirmSubmit} onOpenChange={(o) => !submitting && setConfirmSubmit(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit run?</DialogTitle>
            <DialogDescription>
              Locks the attempt and jumps to debrief. You won&apos;t be able to come
              back to it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <Tile label="Answered" value={`${answeredCount}/${questions.length}`} />
            <Tile label="Marked" value={String(markedCount)} />
            <Tile
              label="Time used"
              value={formatDuration(elapsedMs)}
              accent={overtime ? "bad" : undefined}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmSubmit(false)}
              disabled={submitting}
            >
              Keep going
            </Button>
            <Button
              variant="signal"
              onClick={() => submitAttempt()}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {abortReason && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm">
          <div className="panel-deep pop-in max-w-md p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-bad/50 bg-bad-soft text-bad shadow-[0_0_0_1px_rgba(239,83,80,0.3),0_0_24px_-4px_rgba(239,83,80,0.5)]">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-bad">
              Run aborted
            </p>
            <p className="mt-2 text-sm text-foreground-dim">{abortReason}</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Submitting to debrief…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

function TopBar({
  remainingMs,
  totalMs,
  answered,
  total,
  marked,
  integrityCount,
  overtime,
  onSubmit,
}: {
  remainingMs: number;
  totalMs: number;
  answered: number;
  total: number;
  marked: number;
  integrityCount: number;
  overtime: boolean;
  onSubmit: () => void;
}) {
  const pctLeft = totalMs > 0 ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100)) : 0;
  const danger = remainingMs < 60_000;
  const timerColor = danger ? "text-bad" : overtime ? "text-bad" : "text-foreground";
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex items-center gap-6 px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-signal/40 bg-signal/8 text-signal shadow-[inset_0_1px_0_0_rgba(45,212,241,0.25)]">
            <span className="font-mono text-[10px] font-bold tracking-[0.18em]">WP</span>
          </div>
          <div className="flex flex-col leading-none">
            <div className="flex items-center gap-1.5">
              <span className="dot text-bad pod-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bad">
                lockdown
              </span>
            </div>
            <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
              pod · live run
            </span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="flex items-baseline gap-2">
              <Hourglass
                className={cn(
                  "h-4 w-4 self-center",
                  danger ? "text-bad pod-pulse" : overtime ? "text-bad" : "text-muted",
                )}
              />
              <span className={cn("digit text-3xl", timerColor, danger && "pod-pulse")}>
                {formatDuration(remainingMs)}
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted">
                / {formatDuration(totalMs)}
              </span>
            </div>
            <div className="mt-1.5 hidden h-1 w-64 overflow-hidden rounded-full bg-surface-2 md:block">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700",
                  danger
                    ? "bg-bad shadow-[0_0_8px_0_rgba(239,83,80,0.6)]"
                    : "bg-signal shadow-[0_0_8px_0_rgba(45,212,241,0.5)]",
                )}
                style={{ width: `${pctLeft}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Stat label="answered" value={`${answered}/${total}`} />
          <span className="h-6 w-px bg-border" />
          <Stat label="marked" value={String(marked)} />
          <span className="h-6 w-px bg-border" />
          <Stat
            label="flags"
            value={`${integrityCount}/${ABORT_THRESHOLD}`}
            accent={integrityCount > 0 ? "bad" : undefined}
          />
          <Button size="sm" variant="signal" className="ml-2" onClick={onSubmit}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Submit
          </Button>
        </div>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "bad";
}) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted">{label}</span>
      <span
        className={cn(
          "mt-0.5 digit text-sm",
          accent === "bad" ? "text-bad" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Spec({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "signal" | "bad";
}) {
  const color =
    tone === "signal"
      ? "text-signal"
      : tone === "bad"
        ? "text-bad"
        : "text-foreground";
  return (
    <li className="flex items-center justify-between border-b border-border/60 pb-2.5 last:border-0 last:pb-0">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      <span className={cn("font-mono text-sm tabular", color)}>{value}</span>
    </li>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "bad";
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3 text-left">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 digit text-lg",
          accent === "bad" ? "text-bad" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function QuestionView({
  index,
  total,
  question,
  picked,
  isMarked,
  questionElapsedSec,
  onPick,
  onToggleMark,
}: {
  index: number;
  total: number;
  question: RuntimeQuestion;
  picked: number;
  isMarked: boolean;
  questionElapsedSec: number;
  onPick: (i: number) => void;
  onToggleMark: () => void;
}) {
  const budget = question.recommendedSec ?? null;
  const over = budget != null && questionElapsedSec > budget;
  const near = budget != null && !over && questionElapsedSec > budget * 0.75;
  return (
    <article key={question.id} className="panel p-7 pop-in">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted">
            Question
          </span>
          <span className="digit text-lg text-foreground">
            {String(index + 1).padStart(2, "0")}
            <span className="text-muted">
              /{String(total).padStart(2, "0")}
            </span>
          </span>
          {budget != null && (
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tabular tracking-[0.06em] shadow-[var(--clay-chip)]",
                over
                  ? "bg-bad-soft text-bad"
                  : near
                    ? "bg-warn-soft text-warn"
                    : "bg-surface-2 text-muted",
              )}
              title="Advisory time budget for this question type"
            >
              <Hourglass className="h-3 w-3" />
              {questionElapsedSec}s / {budget}s
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant={isMarked ? "subtle" : "ghost"}
          onClick={onToggleMark}
        >
          <Flag
            className={cn(
              "h-3.5 w-3.5",
              isMarked ? "text-warn fill-warn/40" : "text-muted",
            )}
          />
          {isMarked ? "Marked" : "Mark"}
        </Button>
      </div>
      <QuestionContent
        content={question.stem}
        className="mt-5 text-[16px] font-semibold leading-relaxed text-foreground"
      />
      <ul className="mt-7 space-y-2.5">
        {question.displayChoices.map((c, i) => {
          const selected = picked === i;
          return (
            <li key={i}>
              <button
                onClick={() => onPick(i)}
                className={cn(
                  "flex w-full items-start gap-3.5 rounded-md border px-4 py-3.5 text-left transition-all duration-150",
                  selected
                    ? "border-signal/70 bg-signal-soft shadow-[inset_0_1px_0_0_rgba(45,212,241,0.18),0_0_0_1px_rgba(45,212,241,0.25),0_0_18px_-8px_rgba(45,212,241,0.6)]"
                    : "border-border bg-surface hover:border-border-bright hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border font-mono text-[11px] font-bold transition-colors",
                    selected
                      ? "border-signal bg-signal text-black"
                      : "border-border-strong bg-surface-2 text-muted",
                  )}
                >
                  {LETTERS[i]}
                </span>
                <span
                  className={cn(
                    "text-[14.5px] leading-relaxed",
                    selected
                      ? "font-semibold text-foreground"
                      : "font-medium text-foreground-dim",
                  )}
                >
                  {c}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function Navigator({
  questions,
  picks,
  marked,
  currentIdx,
  onJump,
}: {
  questions: RuntimeQuestion[];
  picks: Record<string, number>;
  marked: Record<string, boolean>;
  currentIdx: number;
  onJump: (i: number) => void;
}) {
  const answeredCount = Object.values(picks).filter((p) => p >= 0).length;
  return (
    <aside className="panel sticky top-20 self-start p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">Navigator</p>
        <span className="digit text-sm text-foreground">
          {answeredCount}
          <span className="text-muted">/{questions.length}</span>
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {questions.map((q, i) => {
          const answered = (picks[q.id] ?? -1) >= 0;
          const isMarked = !!marked[q.id];
          const isCurrent = i === currentIdx;
          return (
            <button
              key={q.id}
              onClick={() => onJump(i)}
              className={cn(
                "relative flex h-9 w-full items-center justify-center rounded-[4px] border font-mono text-[10px] tabular transition-all duration-150 hover:scale-[1.04]",
                isCurrent
                  ? "border-signal bg-signal/20 text-signal shadow-[0_0_0_1px_rgba(45,212,241,0.4),0_0_12px_-4px_rgba(45,212,241,0.7)]"
                  : answered
                    ? "border-good/40 bg-good-soft text-foreground"
                    : "border-border bg-surface-2 text-muted hover:border-border-bright",
              )}
              aria-label={`Question ${i + 1}${answered ? " (answered)" : ""}${isMarked ? " (marked)" : ""}`}
            >
              {i + 1}
              {isMarked && (
                <Flag className="absolute -right-1 -top-1 h-2.5 w-2.5 fill-warn text-warn" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-2 border-t border-border pt-4 text-[10px] uppercase tracking-[0.16em] text-muted">
        <LegendDot color="bg-good-soft border-good/40">answered</LegendDot>
        <LegendDot color="bg-signal/20 border-signal/60">current</LegendDot>
        <LegendDot color="bg-warn">marked</LegendDot>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-border pt-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted">
          <span>Keys</span>
        </div>
        <div className="space-y-1.5 text-[10px] uppercase tracking-[0.14em] text-muted">
          <KeyRow keys={["A", "—", "E"]} label="pick" />
          <KeyRow keys={["←", "→"]} label="nav" />
          <KeyRow keys={["M"]} label="mark" />
          <KeyRow keys={["⌘", "↵"]} label="submit" />
        </div>
      </div>
    </aside>
  );
}

function KeyRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={`${k}-${i}`}
            className={cn(
              "inline-flex h-4 min-w-[16px] items-center justify-center rounded-[3px] border border-border-strong bg-surface-2 px-1 font-mono text-[9px] font-semibold text-foreground-dim shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.4)]",
              k === "—" && "border-transparent bg-transparent px-0 text-muted shadow-none",
            )}
          >
            {k}
          </kbd>
        ))}
      </div>
      <span>{label}</span>
    </div>
  );
}

function LegendDot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-[3px] border", color)} />
      {children}
    </div>
  );
}

function humanizeKind(k: IntegrityKind): string {
  switch (k) {
    case "blur":
      return "lost focus";
    case "visibility_hidden":
      return "tab hidden";
    case "fullscreen_exit":
      return "left fullscreen";
    case "copy":
      return "copy blocked";
    case "paste":
      return "paste blocked";
    case "context_menu":
      return "right-click blocked";
    case "nav_block":
      return "navigation blocked";
    case "shortcut_block":
      return "shortcut blocked";
  }
}
