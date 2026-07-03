# Adaptive Timing, Telemetry & WilliamsSync

The **WilliamsPod Upgrade**: per-question time budgets that adapt to the
question and the runner, per-question behavioural telemetry, a heuristic error
classifier, and a clean `PodTelemetryPacket` that syncs to **WilliamsHub** over
**WilliamsSync** — either **pushed** to a hub ingest URL or **pulled** by the
hub from a token-gated export. Everything here is additive — existing attempts,
grading, and the overall run timer are untouched. Telemetry is only recorded
when the runtime supplies metrics, so old attempts and API-only submissions
still work unchanged.

> Note on stack: the spec mentioned Postgres/Supabase/Prisma, but WilliamsPod
> runs on **libSQL (Turso) + Drizzle**. Built on the existing stack (additive,
> no rewrite). The Drizzle table below is the equivalent of a Prisma model.

## Architecture

```
                         ┌──────────────────────────── during the run ───────────────────────────┐
lib/timing/service.ts    exam-runtime.tsx tracks, per question:
  computeTiming(input)   • clickCount        • answerChangeCount
     ▲                   • revisitCount       • timeTakenMs        • confidence (optional)
     │ per-question budget                    │
  (type × difficulty                          ▼
   × mode × profile)     POST /api/attempts/[id]/submit  { answers[], telemetry[] }
                                              │
                                              ▼
                         lib/attempts.ts  submitAttempt()
                            grades → for each answered item:
                            classifyAttempt() + computeTiming()
                                              │
                                              ▼
                         lib/telemetry/store.ts  saveTelemetry()  ─►  question_telemetry (Drizzle)
                                              │
             ┌────────────────────────────────┼─────────────────────────────────┐
             ▼                                                                    ▼
   /run/[attemptId]/debrief                                    buildPodTelemetryPacket()  ── one shared shape
   summarize() → timing tiles,                                    │
   error mix, per-wrong badges              PUSH ◄────────────────┴────────────────► PULL
                                            enqueuePacket()                          GET /api/sync/export
                                            POST /api/williams-sync/pod-telemetry    (token-gated, CORS)
                                            ─► WilliamsHub (WILLIAMS_SYNC_URL)        ◄─ WilliamsHub reads
```

## Files

| File | Role |
| --- | --- |
| `lib/timing/types.ts` | `TimingMode` (8), `QuestionType` (8), `QuestionDifficulty` (1\|2\|3), `ConceptDepth`, `TimingProfile`, `TimingInput`, `TimingResult` |
| `lib/timing/service.ts` | `computeTiming()` — base table × mode × difficulty × depth × profile factors, clamped to min/max; `inferQuestionType()` |
| `lib/telemetry/types.ts` | `TIMING_CATEGORIES` (4), `ERROR_TYPES` (8), `TRAP_TYPES`, `ConfidenceLevel`, `QuestionMetrics`, `TelemetryRecord` |
| `lib/telemetry/classify.ts` | `classifyAttempt()` — pure heuristic → timing category + error type + signals |
| `lib/telemetry/store.ts` | `saveTelemetry()` (idempotent), list/summarize helpers, `recentErrorCountsByType()` |
| `lib/sync/types.ts` | `PodTelemetryPacket` (v1.0), `MistakeClassification`, `QuestionPerformanceSummary`, `RepairRecommendation` |
| `lib/sync/outbound.ts` | `buildPodTelemetryPacket()`, `enqueuePacket()` (logs by default, POSTs if `WILLIAMS_SYNC_URL` set, never throws) |
| `lib/sync/exportToken.ts` | per-user export token — `issueExportToken()` / `verifyExportToken()`, HMAC of userId with `WILLIAMSPOD_AUTH_SECRET` (format `exp1.<userId>.<sig>`) |
| `lib/db/schema.ts` | `question_telemetry` table (+ migration `0005_*`) |
| `app/api/attempts/[id]/submit/route.ts` | accepts optional `telemetry[]` alongside `answers[]` |
| `app/api/williams-sync/pod-telemetry/route.ts` | **push** — `POST` builds + enqueues the packet for one attempt |
| `app/api/sync/export/route.ts` | **pull** — token-gated, CORS-enabled `GET` returns a user's recent runs as `PodTelemetryPacket[]` (WilliamsHub reads this) |
| `app/api/sync/token/route.ts` | session-authed `GET` — a logged-in user mints their own export token |
| `middleware.ts` | lets `/api/sync/export` bypass the session-cookie gate (it enforces its own token) |
| `app/pod/[attemptId]/exam-runtime.tsx` | instrumentation + advisory per-question timer pill |
| `app/(app)/run/[attemptId]/debrief/page.tsx` | timing tiles, error mix, per-wrong-answer badges |
| `scripts/telemetry-test.ts` | offline unit checks (no DB / no key) |
| `scripts/telemetry-run-test.ts` | full server-path integration test on a throwaway DB |

## 1) Adaptive timing

`computeTiming(input)` returns a per-question budget. The base seconds come from
a per-**type** table, then multiply by independent factors and clamp:

```
recommended = clamp(base × modeFactor × difficultyFactor × depthFactor × profileFactor,
                    min, max)
```

Base budgets (seconds): `recall` 20–30 · `physical_exam` 30–45 · `trap` 45–70 ·
`mechanism` 60–90 · `diagnosis`/`management` 75–105 · `clinical_vignette` 90–120
· `integration` 120–180.

Factors:

- **mode** — `sprint` 0.6 … `standard` 1.0 … `recovery` 1.3 (the eight
  `TIMING_MODES` map the run's mood: sprint / standard / mechanism / clinical /
  trap / pressure / recovery / final_lap).
- **difficulty** — `1 → 0.85`, `2 → 1.0`, `3 → 1.2`.
- **depth** — deeper concept work earns more time.
- **profile** — the adaptive part. Lower `recentAccuracy`, more `priorErrorsOnType`,
  lower `confidence`, and greater `depth` all *increase* the budget; a confident,
  accurate runner on a familiar type gets *less* time.

`inferQuestionType(difficulty, angle?)` picks a type when one isn't explicit:
an explicit variant **angle** wins; otherwise difficulty 1 → `recall`,
3 → `integration`, else `clinical_vignette`.

The timer in the runtime is **advisory** — it shows `elapsed / budget` and turns
amber as you approach and red when you pass it, but never auto-submits. The hard
overall run timer is unchanged.

## 2) Telemetry recording

`exam-runtime.tsx` keeps a per-question metrics record and folds live time for
the currently-open question into the snapshot at submit:

- `clickCount` — option interactions
- `answerChangeCount` — how many times the selection changed
- `revisitCount` — times the runner navigated back to the question
- `timeTakenMs` — accumulated focus time
- `confidence` — optional 1–5 self-rating

These ride along in the submit body as `telemetry[]`. `submitAttempt` grades
first, then for each answered item runs `classifyAttempt()` + `computeTiming()`
and persists a row via `saveTelemetry()` (idempotent: it clears any existing
rows for the attempt, then inserts). Rows keep `originalQuestionId` /
`variantId` provenance so a variant's telemetry still rolls up to the base
concept.

## 3) Error classification

`classifyAttempt()` is a pure function over correctness + time + interaction
metrics (`FAST_RATIO 0.5`, `SLOW_RATIO 1.4` of the recommended time):

| Timing category | Meaning |
| --- | --- |
| `fast_correct` | fluent — knew it cold |
| `slow_correct` | got there, but not fluent (`not_fluent` signal) |
| `fast_wrong` | impulsive / walked into a trap |
| `slow_wrong` | weak concept — worked and still missed |

Error type layers intent on top:

- wrong at high confidence (≥4) → `confidence_error`
- fast + wrong → `trap_error` (`distractor_trap`)
- slow + many changes → `overthinking_error`
- slow + wrong → the concept error for the type (`mechanism_error`,
  `integration_error`, `recall_error`, `frame_error`, …)

Plus behavioural `signals[]`: `many_clicks` · `many_changes` · `many_revisits` ·
`not_fluent` · `impulsive` · `decisive` · `trap_risk`.

## 4) WilliamsSync

The single shared contract between the two apps is the `PodTelemetryPacket`.
`buildPodTelemetryPacket(attemptId, userId, telemetry)` produces a stable,
versioned (v1.0) packet with:

- `performance[]` — per-question summaries (type, timing category, time),
- `mistakes[]` — rollup grouped by `errorType`,
- `repairRecommendations[]` — one per mistake group, with a recommended action
  and priority (e.g. `mechanism_error → high`), each tracing back to its
  `sourceQuestionId` (the **base** question, via `originalQuestionId`).

There are **two transports**, and both build the exact same packet:

**Push** (WilliamsPod → WilliamsHub). `enqueuePacket(packet)` **logs by default**
and only POSTs to WilliamsHub when `WILLIAMS_SYNC_URL` is set — it never throws
into the request path. `POST /api/williams-sync/pod-telemetry` drives it for one
attempt. This is the seam for when WilliamsHub can receive; hub-side ingestion is
**not** implemented here.

**Pull** (WilliamsHub ← WilliamsPod). `GET /api/sync/export` is token-gated and
CORS-enabled, returning a user's recent runs as `PodTelemetryPacket[]` (bounded
by `?limit`, default 25). It bypasses the session-cookie middleware because a
cross-origin caller has no cookie — instead it requires an **export token**
(`?token=` or `Authorization: Bearer`). The token is an HMAC of the userId signed
with the existing `WILLIAMSPOD_AUTH_SECRET` (`lib/sync/exportToken.ts`), so no new
env var is needed. A logged-in user mints their own token at
`GET /api/sync/token` and pastes it into WilliamsHub.

> The export token is long-lived and read-only (it exposes that one user's
> telemetry). Rotate it by rotating `WILLIAMSPOD_AUTH_SECRET` — which also
> invalidates sessions, so treat rotation as a full re-login event.

```bash
# When WilliamsHub is ready, point WilliamsPod at its ingest endpoint:
WILLIAMS_SYNC_URL=https://williamshub.example/api/ingest/pod-telemetry
WILLIAMS_SYNC_TOKEN=...   # sent as a bearer token if set
```

`POST /api/williams-sync/pod-telemetry` with `{ attemptId }` (authenticated,
own attempts only) builds the packet from stored telemetry, enqueues it, and
returns `{ ok, transport, mistakeGroups, repairRecommendations, packet }` so the
shape can be inspected before WilliamsHub exists.

## Local testing

```bash
# 1) Offline unit checks — timing budgets, classification, packet build (no DB/key).
npx tsx scripts/telemetry-test.ts

# 2) Full server-path test on a THROWAWAY DB (submit → classify → store →
#    debrief summary → sync packet). Never touches prod.
DATABASE_URL=file:/tmp/wp-teltest.db npm run db:migrate
DATABASE_URL=file:/tmp/wp-teltest.db npx tsx scripts/telemetry-run-test.ts

# 3) In-app end to end:
#    Run any mock → the per-question pill shows elapsed / budget (amber near, red over).
#    Answer, change answers, revisit questions → submit.
#    Debrief shows the "Timing & error telemetry" panel:
#      fast/slow × correct/wrong tiles, the error mix, median time,
#      and each wrong answer tagged with its timing category + error type.

# 4) Inspect the PUSH packet without WilliamsHub:
#    POST /api/williams-sync/pod-telemetry { "attemptId": "<id>" }
#    → returns the built PodTelemetryPacket + repair recommendations.
#    With no WILLIAMS_SYNC_URL set, enqueuePacket just logs (transport: "logged").

# 5) Exercise the PULL export (what WilliamsHub reads):
#    GET /api/sync/token           (logged in) → { token, origin, exportUrl }
#    GET /api/sync/export?token=…  → { packets: PodTelemetryPacket[] }   (no cookie needed)
#    GET /api/sync/export?token=bad → 401
```

## Connecting to WilliamsHub

WilliamsPod is the **wind tunnel**; WilliamsHub is where repair happens. The
contract between them is the `PodTelemetryPacket`, and it can flow either way —
pick whichever the deployment makes easy:

**Pull (works today, zero config on the hub).** The user opens
`GET /api/sync/token` in WilliamsPod, copies the `token` + `origin`, and pastes
them into WilliamsHub → Repair → Connect WilliamsPod. WilliamsHub then polls
`GET /api/sync/export?token=…&limit=25` and consumes the returned
`mistakes[]` + `repairRecommendations[]` to seed its repair queue and
concept-depth work. No env var on the WilliamsPod side beyond the
`WILLIAMSPOD_AUTH_SECRET` it already has.

**Push (for when the hub can receive).** Set `WILLIAMS_SYNC_URL` (+ optional
`WILLIAMS_SYNC_TOKEN`); `enqueuePacket()` then POSTs each attempt's packet to
that ingest endpoint. Until the URL is set, the push path runs safely offline —
building and logging packets without any external dependency.

Both directions build the identical packet via `buildPodTelemetryPacket`, so
whichever WilliamsHub adopts, it reads the same shape.
