"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const PROMPT_TEMPLATE = `You are generating practice multiple-choice questions for medical-board exam prep in the WilliamsPod format. Use ONLY the sources in this notebook as content. Do NOT invent facts beyond what the sources support.

SUBJECT: <SUBJECT>
LANGUAGE: English only — no Thai or other scripts in stems, choices, or explanations.

For every lecture or major topic in the sources, produce 8–15 clinically realistic vignette MCQs. Each question must follow this structure:

  - STEM: 2–5 sentence patient/clinical vignette. Avoid one-liner fact recall.
  - CHOICES: exactly four (A–D) OR five (A–E) plausible options. Distractors should be common clinical confusions, not nonsense.
  - CORRECT: a single letter (A, B, C, D, or E).
  - EXPLANATION: 3–6 sentences. Name the correct answer, give the reasoning, and briefly say why the most plausible distractors are wrong.
  - TOPIC: 1–3 word concept tag (e.g. "T2DM management", "Cushing diagnosis").
  - DIFFICULTY: integer 1, 2, or 3.
      1 = recall / single-step
      2 = interpretation / two-step
      3 = synthesis / multi-step or differential

OUTPUT FORMAT
=============

Group the questions by lecture. Above every lecture's table, write a heading on its own line in this exact form:

    ### LT## Short Lecture Title

Use the lecture's actual number from the sources (LT01, LT02, …). Then a single Markdown table with these EXACT column headers in this order:

| question | A | B | C | D | E | correct | explanation | topic | difficulty |

If a question has only four choices, leave the E column empty. Inside cells, do not use newlines or pipe characters — replace them with spaces or semicolons.

Do not write anything else (no preamble, no apologies, no footer). Output only the headings and tables.

EXAMPLE
=======

### LT01 Glucose homeostasis

| question | A | B | C | D | E | correct | explanation | topic | difficulty |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A 45-year-old man with a 10-year history of type 2 diabetes presents with progressive fatigue and polyuria. HbA1c is 9.8% despite metformin 1 g BID. Which next step best lowers HbA1c while supporting weight loss and cardiovascular outcomes? | Add a sulfonylurea | Add a GLP-1 receptor agonist | Increase metformin to 1 g TID | Switch to basal insulin alone | Add an SGLT2 inhibitor | B | GLP-1 receptor agonists (e.g. semaglutide, liraglutide) are guideline-preferred add-ons to metformin when weight loss and cardiovascular risk reduction are priorities. Sulfonylureas (A) cause hypoglycemia and weight gain. Pushing metformin higher (C) yields diminishing returns and GI side effects. Basal insulin alone (D) is reserved for severe symptomatic hyperglycemia or after failure of multiple orals. SGLT2 inhibitors (E) are also valid but GLP-1 RAs are preferred when weight loss is the dominant goal. | T2DM management | 2 |

Begin now. Produce the headings + tables only.`;

export function NotebookLmHelper({
  defaultSubject = "",
}: {
  defaultSubject?: string;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [copied, setCopied] = useState(false);

  const prompt = PROMPT_TEMPLATE.replace(
    "<SUBJECT>",
    subject.trim() || "<SUBJECT>",
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 text-left">
          <span className="dot text-signal" />
          <div>
            <p className="eyebrow">NotebookLM prompt</p>
            <p className="mt-0.5 text-[11px] text-foreground-dim">
              Generate more questions from your lecture sources
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-5 py-4">
          <ol className="space-y-1.5 text-xs text-foreground-dim">
            <li>
              <span className="font-semibold text-foreground">1.</span> Open
              your NotebookLM notebook with the lecture sources loaded.
            </li>
            <li>
              <span className="font-semibold text-foreground">2.</span> Type a
              subject below (e.g. <span className="font-mono">HEN-2</span>,
              <span className="font-mono"> HNS-2</span>), copy the prompt,
              paste it into NotebookLM.
            </li>
            <li>
              <span className="font-semibold text-foreground">3.</span> Paste
              NotebookLM&apos;s Markdown output into Google Sheets (one tab
              per <span className="font-mono">### LT##</span> heading),
              download as <span className="font-mono">.xlsx</span>.
            </li>
            <li>
              <span className="font-semibold text-foreground">4.</span> Upload
              the file above with the same Subject — the new lectures join the
              existing mock.
            </li>
          </ol>

          <div className="space-y-2">
            <label
              htmlFor="nlm-subject"
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted"
            >
              Subject to bake into the prompt
            </label>
            <input
              id="nlm-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. HEN-2"
              maxLength={40}
              className="flex h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm font-mono tracking-[0.1em] text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            />
          </div>

          <div className="relative">
            <pre className="max-h-72 overflow-auto rounded-md border border-border bg-background-tint p-3 font-mono text-[11px] leading-relaxed text-foreground-dim">
              {prompt}
            </pre>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant={copied ? "subtle" : "signal"}
                onClick={copy}
                disabled={!subject.trim()}
                title={!subject.trim() ? "Type a subject first" : "Copy prompt"}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy prompt
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
