"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionContent } from "@/components/question-content";
import {
  ANGLE_META,
  type QuestionAngle,
  type QuestionVariant,
  type VariationDifficulty,
} from "@/lib/variations/types";
import {
  Sparkles,
  ChevronDown,
  Trash2,
  Check,
  Info,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** The provenance label the spec asks for. */
const PROVENANCE_LABEL = "Modified from original question bank";

const DIFF_TONE: Record<VariationDifficulty, "good" | "neutral" | "bad"> = {
  easier: "good",
  same: "neutral",
  harder: "bad",
};

export function VariantPanel({
  baseQuestionId,
  canManage = false,
}: {
  baseQuestionId: string;
  canManage?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [variants, setVariants] = useState<QuestionVariant[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ provider: string; objective: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/questions/${baseQuestionId}/variants`);
      if (res.ok) {
        const j = await res.json();
        setVariants(j.variants ?? []);
      }
    } finally {
      setLoaded(true);
    }
  }, [baseQuestionId]);

  useEffect(() => {
    if (open && !loaded) void load();
  }, [open, loaded, load]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${baseQuestionId}/variants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}), // all eight angles by default
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? `Generation failed (${res.status})`);
        return;
      }
      setMeta({ provider: j.provider, objective: j.learningObjective });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/variants/${id}`, { method: "DELETE" });
    if (res.ok) setVariants((vs) => vs.filter((v) => v.id !== id));
  }

  return (
    <div className="rounded-md border border-border bg-surface-2/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-signal" />
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-strong">
            Concept variations
          </span>
          {loaded && variants.length > 0 && (
            <Badge tone="signal">{variants.length}</Badge>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-3.5 py-3">
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Same concept, different angles — so runners can&apos;t memorise a
            repeated stem. The correct concept and medical facts are preserved.
          </p>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="signal"
                size="sm"
                onClick={generate}
                disabled={busy}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {busy
                  ? "Generating…"
                  : variants.length > 0
                    ? "Generate more"
                    : "Generate variations"}
              </Button>
              {meta && (
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  via {meta.provider}
                </span>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-md border border-bad/40 bg-bad-soft p-2.5 text-[11px] text-bad">
              {error}
            </p>
          )}

          {loaded && variants.length === 0 && !busy && (
            <p className="text-[11px] text-muted">
              No variations yet{canManage ? " — generate a set above." : "."}
            </p>
          )}

          <ul className="space-y-2.5">
            {variants.map((v) => (
              <li key={v.id}>
                <VariantCard v={v} onRemove={canManage ? remove : undefined} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function VariantCard({
  v,
  onRemove,
}: {
  v: QuestionVariant;
  onRemove?: (id: string) => void;
}) {
  return (
    <article className="rounded-md border border-border bg-surface p-3.5 shadow-[var(--clay-chip)]">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="signal">{ANGLE_META[v.angle as QuestionAngle].label}</Badge>
        <Badge tone={DIFF_TONE[v.difficulty]}>{v.difficulty}</Badge>
        {v.conceptTag && <Badge tone="neutral">{v.conceptTag}</Badge>}
        <span className="ml-auto flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
          <Sparkles className="h-3 w-3 text-signal" />
          {PROVENANCE_LABEL}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(v.id)}
            className="text-muted transition-colors hover:text-bad"
            aria-label="Delete variant"
            title="Delete variant"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <QuestionContent
        content={v.stem}
        className="text-[13.5px] font-semibold leading-relaxed text-foreground"
      />

      <ul className="mt-2.5 space-y-1">
        {v.choices.map((c, i) => {
          const isCorrect = i === v.correctIndex;
          return (
            <li
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-[5px] px-2 py-1",
                isCorrect ? "bg-good-soft text-good" : "text-foreground-dim",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border font-mono text-[9px] font-semibold",
                  isCorrect
                    ? "border-good/50 bg-good/20 text-good"
                    : "border-border-strong bg-surface-2 text-muted",
                )}
              >
                {LETTERS[i]}
              </span>
              <span className={cn("flex-1 text-[12.5px]", isCorrect && "font-semibold")}>
                {c}
              </span>
              {isCorrect && <Check className="mt-0.5 h-3 w-3" />}
            </li>
          );
        })}
      </ul>

      {v.explanation && (
        <div className="mt-2.5 rounded-md border border-signal/25 bg-signal-soft p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-signal">
            Why
          </p>
          <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-foreground-dim">
            {v.explanation}
          </p>
        </div>
      )}
    </article>
  );
}
