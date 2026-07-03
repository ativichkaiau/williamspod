# Question Variation System

Turns any bank question into **concept variations** that test the same
underlying idea from different angles, so a runner can't pass by memorising a
repeated stem. Variants preserve the original learning objective and never
change medical truth — only the framing changes.

> Note on stack: the spec mentioned Postgres/Supabase/Prisma, but WilliamsPod
> runs on **libSQL (Turso) + Drizzle**. This feature is built on the existing
> stack (additive, no rewrite). The Drizzle table below is the equivalent of a
> Prisma model.

## Architecture

```
Base question (bank)
        │
        ▼
lib/variations/service.ts  ──►  selectProvider()  ──►  providers.ts
   generateVariants()                                   • placeholder (default, offline)
        │                                               • openai       (OPENAI_API_KEY)
        │  strict JSON                                  • anthropic    (ANTHROPIC_API_KEY)
        ▼
parseAiVariationResponse()  (Zod contract + correctIndex range check)
        │
        ▼
lib/variations/store.ts  ──►  question_variants table (Drizzle)
        │
        ▼
GET/POST /api/questions/[id]/variants     DELETE /api/variants/[id]
        │
        ▼
components/variations/variant-panel.tsx   (angle badges + "Modified from
   wired into the bank question editor      original question bank" label)
```

## Files

| File | Role |
| --- | --- |
| `lib/variations/types.ts` | `BaseQuestion`, `QuestionVariant`, `QuestionAngle` (8), `VariationDifficulty`, strict-JSON Zod contract + `parseAiVariationResponse` |
| `lib/variations/prompt.ts` | System + user prompt enforcing concept/medical-truth preservation and strict JSON |
| `lib/variations/providers.ts` | `VariationProvider` interface, `PlaceholderProvider` (default), `OpenAiProvider`, `AnthropicProvider`, `selectProvider()` |
| `lib/variations/service.ts` | `generateVariants()` — provider call + validation boundary |
| `lib/variations/store.ts` | Load base question, list / save / archive variants (Drizzle) |
| `lib/variations/examples.ts` | Aortic-dissection reference module (all 8 angles) |
| `lib/db/schema.ts` | `question_variants` table (+ migration `0003_*`) |
| `app/api/questions/[id]/variants/route.ts` | `GET` list, `POST` generate+persist (admin) |
| `app/api/variants/[id]/route.ts` | `DELETE` (admin) |
| `components/variations/variant-panel.tsx` | Collapsible panel in the bank editor |
| `scripts/variations-demo.ts` | Offline pipeline check (no DB/key) |

## The eight angles

`recall` · `mechanism` · `clinical_vignette` · `physical_exam` · `diagnosis`
· `management` · `trap` · `integration`

Difficulty of a variant relative to the base: `easier` · `same` · `harder`.

## Provider selection

Zero config → **placeholder** (deterministic, offline, safe). Override with env:

```bash
# auto: ANTHROPIC_API_KEY → Claude, else OPENAI_API_KEY → OpenAI, else placeholder
VARIATION_PROVIDER=openai      # force a provider
OPENAI_API_KEY=sk-...          # OpenAI (or any OpenAI-compatible endpoint via OPENAI_BASE_URL)
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_API_KEY=sk-ant-...   # Claude
ANTHROPIC_MODEL=claude-sonnet-4-6
```

The placeholder never invents medical facts — it re-frames the base question
per angle and keeps the base's own correct answer. Real providers are prompted
to preserve the learning objective and medical truth, and their output is
validated against the strict Zod contract before it can be stored.

## Strict JSON contract

```json
{
  "learningObjective": "one sentence — the preserved concept",
  "variants": [
    {
      "angle": "mechanism",
      "difficulty": "same",
      "stem": "…",
      "choices": ["…", "…", "…", "…"],
      "correctIndex": 1,
      "explanation": "…",
      "conceptTag": "aortic root → AR"
    }
  ]
}
```

Anything not matching (bad shape, `correctIndex` out of range, unknown angle)
is rejected by `parseAiVariationResponse()` before persistence.

## Live runs

Turn on **"Use concept variations"** in `/run/new` (the Anti-memorisation
section). When enabled, `createAttempt`:

- for each selected question that has non-archived variants, seed-picks one
  and serves it **in place of** the base question;
- stores `attempt_answers.variantId` (the base `questionId` is kept, so
  per-lecture / per-topic telemetry is unchanged);
- grades against the **variant's** correct answer.

Everything downstream resolves the "effective" item via
`lib/variations/effective.ts` (`resolveEffectiveItems`): the runtime serves
the variant stem/choices, `submitAttempt` grades it, and the debrief's
wrong-answer review tags it `variant · <angle>` with the "Modified from
original question bank" label. Attempts with no variant (`variantId = null`)
behave exactly as before — the whole change is additive.

Migration `0004` adds the nullable `attempt_answers.variant_id` column.

## Local testing

```bash
# 0) End-to-end run test (variant substituted, graded, debriefed) on a throwaway DB.
DATABASE_URL=file:/tmp/wp-vartest.db npm run db:migrate
DATABASE_URL=file:/tmp/wp-vartest.db npx tsx scripts/variations-run-test.ts

# 1) Offline pipeline check — validates the example + runs the placeholder.
npx tsx scripts/variations-demo.ts

# 2) In-app: log in as admin → Bank → a subject → lecture → a question →
#    expand "Concept variations" → "Generate variations".
#    Each card shows its angle, relative difficulty, and the provenance label
#    "Modified from original question bank".

# 3) With a real model, add a key to .env.local and restart:
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env.local   # or OPENAI_API_KEY=...
```

## Example

See `lib/variations/examples.ts` for the full aortic-dissection base question
and its eight-angle variant set (recall / mechanism / clinical_vignette /
physical_exam / diagnosis / management / trap / integration), each preserving
the objective *"aortic root involvement → acute aortic regurgitation"*.
