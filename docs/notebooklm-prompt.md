# NotebookLM → WilliamsPod question pipeline

A reproducible workflow for generating new mock questions from lecture
material via NotebookLM and uploading them into a WilliamsPod subject.

## How to use it

1. In NotebookLM, create or open a notebook containing your source material
   (lecture slides, articles, textbook chapters).
2. Replace `<SUBJECT>` in the prompt below with the WilliamsPod subject this
   batch belongs to (e.g. `HEN-2`, `HNS-2`, `NEU-3`, whatever you'll set in
   the upload form).
3. Paste the prompt into NotebookLM and let it generate.
4. Copy NotebookLM's output (it should be a sequence of `### LT## …` headings
   followed by Markdown tables).
5. Open a fresh Google Sheet. For each `### LT##` block, create a sheet whose
   tab name is the heading (Google Sheets accepts up to 31 chars). Paste the
   Markdown table — Sheets auto-parses it.
   - Faster path: paste the full output into a single sheet, then split with
     `Data → Split text to columns` and re-tab manually, or use the
     [Markdown to Google Sheets](https://workspace.google.com) add-on.
6. **File → Download → Microsoft Excel (.xlsx)**.
7. In WilliamsPod, go to `/upload`. Drag the `.xlsx` in. Set **Subject** to the
   same `<SUBJECT>` you used in the prompt. Click **Load into bank**.
8. The new lectures appear under that subject in `/bank` and join the
   `/run/new` "Quick mock" button automatically.

## The prompt

Copy everything between the `=== START ===` and `=== END ===` markers and
replace `<SUBJECT>` before pasting into NotebookLM.

```
=== START ===
You are generating practice multiple-choice questions for medical-board exam
prep in the WilliamsPod format. Use ONLY the sources in this notebook as
content. Do NOT invent facts beyond what the sources support.

SUBJECT: <SUBJECT>
LANGUAGE: English only — no Thai or other scripts in stems, choices, or
explanations.

For every lecture or major topic in the sources, produce 8–15 clinically
realistic vignette MCQs. Each question must follow this structure:

  - STEM: 2–5 sentence patient/clinical vignette. Avoid one-liner fact recall.
  - CHOICES: exactly four (A–D) OR five (A–E) plausible options. Distractors
    should be common clinical confusions, not nonsense.
  - CORRECT: a single letter (A, B, C, D, or E).
  - EXPLANATION: 3–6 sentences. Name the correct answer, give the reasoning,
    and briefly say why the most plausible distractors are wrong.
  - TOPIC: 1–3 word concept tag (e.g. "T2DM management", "Cushing diagnosis").
  - DIFFICULTY: integer 1, 2, or 3.
      1 = recall / single-step
      2 = interpretation / two-step
      3 = synthesis / multi-step or differential

OUTPUT FORMAT
=============

Group the questions by lecture. Above every lecture's table, write a heading
on its own line in this exact form:

    ### LT## Short Lecture Title

Use the lecture's actual number from the sources (LT01, LT02, …). Then a
single Markdown table with these EXACT column headers in this order:

| question | A | B | C | D | E | correct | explanation | topic | difficulty |

If a question has only four choices, leave the E column empty. Inside cells,
do not use newlines or pipe characters — replace them with spaces or
semicolons.

Do not write anything else (no preamble, no apologies, no footer). Output
only the headings and tables.

EXAMPLE
=======

### LT01 Glucose homeostasis

| question | A | B | C | D | E | correct | explanation | topic | difficulty |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A 45-year-old man with a 10-year history of type 2 diabetes presents with progressive fatigue and polyuria. HbA1c is 9.8% despite metformin 1 g BID. Which next step best lowers HbA1c while supporting weight loss and cardiovascular outcomes? | Add a sulfonylurea | Add a GLP-1 receptor agonist | Increase metformin to 1 g TID | Switch to basal insulin alone | Add an SGLT2 inhibitor | B | GLP-1 receptor agonists (e.g. semaglutide, liraglutide) are guideline-preferred add-ons to metformin when weight loss and cardiovascular risk reduction are priorities. Sulfonylureas (A) cause hypoglycemia and weight gain. Pushing metformin higher (C) yields diminishing returns and GI side effects. Basal insulin alone (D) is reserved for severe symptomatic hyperglycemia or after failure of multiple orals. SGLT2 inhibitors (E) are also valid but GLP-1 RAs are preferred when weight loss is the dominant goal. | T2DM management | 2 |

Begin now. Produce the headings + tables only.
=== END ===
```

## Why this format works with WilliamsPod

- **Sheets-per-lecture** matches WilliamsPod's intake (`one Excel sheet per
  lecture, sheet name = lecture name`).
- **`correct` accepts a letter** (A–E) — the parser converts it to an index.
- **`difficulty` 1–3** is what the parser expects; blank is allowed.
- **`topic`** drives weak-topic detection in the debrief.
- **`explanation`** shows up in the wrong-answer review after submission.

## If NotebookLM refuses to output a clean table

NotebookLM sometimes adds commentary or breaks the table. Common fixes:

- Tell it "Output ONLY the table, no commentary." in a follow-up message.
- Ask for one lecture at a time if the output is being truncated.
- If columns get misaligned, ask: "Re-emit the same table but separate columns
  with tabs instead of pipes." Then paste into Sheets as tab-separated.

If a row sneaks past the parser, you can fix it in WilliamsPod itself: open
`/bank/<lecture>`, click **Edit** on the question, and adjust the stem,
choices, or correct letter.
