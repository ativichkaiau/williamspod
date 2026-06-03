"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Question } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { QuestionContent } from "@/components/question-content";
import { Pencil, X, Save, Trash2, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuestionEditor({
  index,
  question,
}: {
  index: number;
  question: Question;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stem, setStem] = useState(question.stem);
  const [choices, setChoices] = useState<string[]>(question.choices);
  const [correctIndex, setCorrectIndex] = useState(question.correctIndex);
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [topic, setTopic] = useState(question.topic ?? "");
  const [difficulty, setDifficulty] = useState<number | null>(question.difficulty);

  function cancel() {
    setStem(question.stem);
    setChoices(question.choices);
    setCorrectIndex(question.correctIndex);
    setExplanation(question.explanation ?? "");
    setTopic(question.topic ?? "");
    setDifficulty(question.difficulty);
    setEditing(false);
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/questions/${question.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stem,
          choices: choices.filter((c) => c.trim().length > 0),
          correctIndex,
          explanation: explanation || null,
          topic: topic || null,
          difficulty,
        }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this question?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/questions/${question.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <article className="panel panel-hover group p-5">
        <div className="flex items-start gap-4">
          <div className="flex w-8 shrink-0 flex-col items-center gap-1">
            <span className="digit text-[11px] text-muted">
              {String(index).padStart(3, "0")}
            </span>
            {question.difficulty != null && (
              <div className="flex flex-col gap-0.5">
                {[1, 2, 3].map((d) => (
                  <span
                    key={d}
                    className={cn(
                      "h-0.5 w-3 rounded-full",
                      d <= (question.difficulty ?? 0)
                        ? question.difficulty === 3
                          ? "bg-bad"
                          : question.difficulty === 2
                            ? "bg-warn"
                            : "bg-good"
                        : "bg-border",
                    )}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3.5">
            <QuestionContent
              content={question.stem}
              className="text-[14.5px] leading-relaxed text-foreground"
              imageClassName="max-w-2xl"
            />
            <ul className="space-y-1.5">
              {question.choices.map((c, i) => {
                const isCorrect = i === question.correctIndex;
                return (
                  <li
                    key={i}
                    className={cn(
                      "flex items-start gap-3 rounded-[5px] px-2 py-1.5",
                      isCorrect
                        ? "bg-good-soft text-good"
                        : "text-foreground-dim",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border font-mono text-[10px] font-semibold",
                        isCorrect
                          ? "border-good/50 bg-good/20 text-good"
                          : "border-border-strong bg-surface-2 text-muted",
                      )}
                    >
                      {LETTERS[i]}
                    </span>
                    <span className="flex-1 text-sm">{c}</span>
                    {isCorrect && <Check className="mt-0.5 h-3.5 w-3.5" />}
                  </li>
                );
              })}
            </ul>
            {question.explanation && (
              <div className="rounded-md border border-signal/25 bg-signal-soft p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-signal">
                  Why
                </p>
                <QuestionContent
                  content={question.explanation}
                  className="mt-1.5 text-xs leading-relaxed text-foreground-dim"
                  imageClassName="max-w-xl"
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {question.topic && <Badge tone="signal">{question.topic}</Badge>}
              {question.difficulty != null && (
                <Badge
                  tone={
                    question.difficulty === 3
                      ? "bad"
                      : question.difficulty === 2
                        ? "warn"
                        : "good"
                  }
                >
                  {["easy", "medium", "hard"][question.difficulty - 1] ??
                    `d${question.difficulty}`}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 opacity-50 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing(true)}
              aria-label="Edit"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              aria-label="Delete"
              title="Delete"
              disabled={busy}
              className="hover:text-bad"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </article>
    );
  }

  // -------------------- Edit mode --------------------
  const canSave =
    !busy && stem.trim().length > 0 && choices.filter((c) => c.trim()).length >= 2;

  return (
    <article className="panel-deep p-6 pop-in">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <span className="dot text-signal pod-pulse" />
          <p className="eyebrow">Editing</p>
          <span className="digit text-xs text-muted">
            Q{String(index).padStart(3, "0")}
          </span>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Cmd+S not wired · use Save
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Question stem</Label>
          <Textarea
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            rows={4}
            className="font-mono text-[13px]"
          />
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
            Use{" "}
            <span className="text-foreground">
              [[image:path|640x480|alt]]
            </span>{" "}
            to inline an image.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Choices</Label>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Click letter to mark correct
            </span>
          </div>
          <div className="space-y-2">
            {choices.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectIndex(i)}
                  aria-label={`Mark choice ${LETTERS[i]} correct`}
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-[5px] border font-mono text-xs font-bold transition-all",
                    correctIndex === i
                      ? "border-good bg-good/20 text-good shadow-[inset_0_1px_0_0_rgba(78,194,127,0.25),0_0_0_1px_rgba(78,194,127,0.35),0_0_14px_-4px_rgba(78,194,127,0.6)]"
                      : "border-border-strong bg-surface-2 text-muted hover:border-good/50 hover:text-foreground",
                  )}
                >
                  {LETTERS[i]}
                </button>
                <Input
                  value={c}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i] = e.target.value;
                    setChoices(next);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove choice"
                  onClick={() => {
                    if (choices.length <= 2) return;
                    const next = choices.filter((_, j) => j !== i);
                    setChoices(next);
                    if (correctIndex === i) setCorrectIndex(0);
                    else if (correctIndex > i) setCorrectIndex(correctIndex - 1);
                  }}
                  disabled={choices.length <= 2}
                  className="hover:text-bad"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {choices.length < 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChoices([...choices, ""])}
              >
                <Plus className="h-3.5 w-3.5" />
                Add choice
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Topic</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. coronary anatomy"
            />
          </div>
          <div className="space-y-2">
            <Label>Difficulty</Label>
            <div className="flex gap-1">
              {([null, 1, 2, 3] as const).map((d) => {
                const active = difficulty === d;
                const tone =
                  d === 1 ? "good" : d === 2 ? "warn" : d === 3 ? "bad" : null;
                return (
                  <button
                    key={String(d)}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "h-9 flex-1 rounded-md border text-[11px] font-semibold uppercase tracking-[0.14em] transition-all",
                      active
                        ? tone === "good"
                          ? "border-good/50 bg-good/15 text-good"
                          : tone === "warn"
                            ? "border-warn/50 bg-warn/15 text-warn"
                            : tone === "bad"
                              ? "border-bad/50 bg-bad/15 text-bad"
                              : "border-border-strong bg-surface-2 text-foreground"
                        : "border-border bg-surface text-muted hover:text-foreground",
                    )}
                  >
                    {d == null ? "—" : ["easy", "med", "hard"][d - 1]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Explanation</Label>
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={3}
            className="font-mono text-[13px]"
            placeholder="Why is the correct answer correct? Shown in debrief."
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="signal" onClick={save} disabled={!canSave}>
          <Save className="h-4 w-4" />
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </article>
  );
}
