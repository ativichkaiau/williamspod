"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Target, Repeat } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/lib/utils";

type Props = {
  attemptId: string;
  durationMs: number;
  weakLectureIds: string[];
  allLectureIds: string[];
};

export function WeakAreaRetryButton({
  durationMs,
  weakLectureIds,
  allLectureIds,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<"weak" | "retry" | null>(null);
  const [busy, setBusy] = useState(false);
  const defaultMin = Math.max(1, Math.round(durationMs / 60_000));
  const [minutes, setMinutes] = useState(defaultMin);

  async function start(mode: "weak" | "retry") {
    if (busy) return;
    setBusy(true);
    try {
      const lectureIds = mode === "weak" ? weakLectureIds : allLectureIds;
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: mode === "weak" ? "weak" : "custom",
          lectureIds,
          durationMs: Math.max(60_000, minutes * 60_000),
          shuffleQuestions: true,
          shuffleChoices: true,
          label:
            mode === "weak"
              ? `Weak areas · ${lectureIds.length} lecture${lectureIds.length === 1 ? "" : "s"}`
              : "Reshuffled retry",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.attemptId) {
        router.push(`/pod/${json.attemptId}`);
      } else {
        alert(json.error ?? "Failed to start the test.");
      }
    } finally {
      setBusy(false);
    }
  }

  const canWeak = weakLectureIds.length > 0;

  return (
    <>
      <Button
        variant={canWeak ? "signal" : "outline"}
        size="sm"
        disabled={!canWeak}
        onClick={() => setOpen("weak")}
        title={
          canWeak
            ? "Start a test from the lectures you scored lowest on"
            : "No weak areas detected — try a reshuffle"
        }
      >
        <Target className="h-3.5 w-3.5" />
        Practise weak areas
      </Button>
      <Button variant="outline" size="sm" onClick={() => setOpen("retry")}>
        <Repeat className="h-3.5 w-3.5" />
        Reshuffle & retry
      </Button>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === "weak" ? "Practise weak areas" : "Reshuffled retry"}
            </DialogTitle>
            <DialogDescription>
              {open === "weak"
                ? `Builds a new test from ${weakLectureIds.length} weak lecture${weakLectureIds.length === 1 ? "" : "s"} (below 70%).`
                : "Same lectures as the original test, reshuffled."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Timer (min)</Label>
            <Input
              type="number"
              min={1}
              max={300}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
            />
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
              Original: {formatDuration(durationMs)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="signal"
              onClick={() => start(open ?? "retry")}
              disabled={busy}
            >
              {busy ? "Starting…" : "Start test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
