"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Question } from "@/lib/db/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { QuestionContent } from "@/components/question-content";
import { Pencil, X, Save, Trash2, Check } from "lucide-react";
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
      <Card className="overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <span className="w-7 shrink-0 pt-0.5 font-mono text-[11px] tabular text-muted">
            {String(index).padStart(3, "0")}
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <QuestionContent
              content={question.stem}
              className="text-sm text-foreground"
              imageClassName="max-w-2xl"
            />
            <ul className="space-y-1.5">
              {question.choices.map((c, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-2 text-sm",
                    i === question.correctIndex
                      ? "text-good"
                      : "text-muted",
                  )}
                >
                  <span className="mt-0.5 w-5 font-mono text-[11px] tabular">
                    {LETTERS[i]}.
                  </span>
                  <span className="flex-1">{c}</span>
                  {i === question.correctIndex && <Check className="mt-0.5 h-3.5 w-3.5" />}
                </li>
              ))}
            </ul>
            {question.explanation && (
              <div className="rounded-md border border-border bg-surface-2 p-3 text-xs text-muted">
                <span className="text-[10px] uppercase tracking-[0.14em] text-foreground">
                  Why
                </span>
                <br />
                <QuestionContent
                  content={question.explanation}
                  className="mt-1.5 text-xs text-muted"
                  imageClassName="max-w-xl"
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {question.topic && <Badge tone="signal">{question.topic}</Badge>}
              {question.difficulty != null && (
                <Badge tone={question.difficulty === 3 ? "bad" : question.difficulty === 2 ? "warn" : "good"}>
                  {["easy", "medium", "hard"][question.difficulty - 1] ?? `d${question.difficulty}`}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing(true)}
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              aria-label="Delete"
              disabled={busy}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <Label>Question</Label>
          <Textarea value={stem} onChange={(e) => setStem(e.target.value)} rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Choices</Label>
          <div className="space-y-2">
            {choices.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectIndex(i)}
                  aria-label={`Mark choice ${LETTERS[i]} correct`}
                  className={cn(
                    "h-7 w-7 shrink-0 rounded-sm border text-[11px] font-semibold transition-colors",
                    correctIndex === i
                      ? "border-good bg-good/15 text-good"
                      : "border-border-strong bg-surface text-muted hover:border-good/60",
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
                + Add choice
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Difficulty</Label>
            <div className="flex gap-1">
              {([null, 1, 2, 3] as const).map((d) => (
                <Button
                  key={String(d)}
                  size="sm"
                  variant={difficulty === d ? "subtle" : "ghost"}
                  onClick={() => setDifficulty(d)}
                >
                  {d == null ? "—" : ["easy", "medium", "hard"][d - 1]}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Explanation</Label>
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={3}
            placeholder="Why is the correct answer correct? Shown in debrief."
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={cancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="signal"
            onClick={save}
            disabled={busy || !stem.trim() || choices.filter((c) => c.trim()).length < 2}
          >
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
