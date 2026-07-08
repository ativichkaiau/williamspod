import type { ErrorType, TimingCategory } from "@/lib/telemetry/types";

/**
 * Race engineer — an on-demand "why did I get this wrong" debrief for a single
 * question. Reuses the same provider seam as the variation system (placeholder
 * by default, OpenAI or Anthropic when a key is present) but returns plain
 * prose, not JSON. It is grounded in the question's own explanation field and
 * the runner's telemetry — it never invents new medical facts.
 */

export interface ExplainInput {
  stem: string;
  choices: string[];
  correctIndex: number;
  /** Source index the runner picked, or -1 if unanswered. */
  pickedIndex: number;
  explanation: string | null;
  topic: string | null;
  lectureName: string | null;
  timingCategory: TimingCategory | null;
  errorType: ErrorType | null;
}

export interface ExplainResult {
  provider: "placeholder" | "openai" | "anthropic";
  model: string | null;
  text: string;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// ---------------------------------------------------------------------------
// Coaching notes keyed off the error classification the run already produced.
// ---------------------------------------------------------------------------

const TELEMETRY_NOTE: Partial<Record<ErrorType, string>> = {
  trap_error:
    "Telemetry says you braked early and took the tempting line. Before you commit, check whether a finding is specific or merely common.",
  overthinking_error:
    "You changed your line mid-corner. Your first read was likely the right one — trust it and move on.",
  timing_error: "You rushed the entry. Give this question type a beat more.",
  recall_error:
    "This is a straight-line fact you didn't have loaded. Re-drill it, then re-test.",
  mechanism_error:
    "You worked it and still missed — the cause→effect pathway isn't set. Take it back to the garage.",
  frame_error:
    "You read the clinical frame wrong. Re-read the vignette and mark what's actually being asked.",
  integration_error:
    "This links two systems around one lesion. Study the connection, not the endpoints.",
  confidence_error:
    "You were sure and wrong — the most expensive kind. Recalibrate before the real exam.",
};

function timingLine(cat: TimingCategory | null): string {
  switch (cat) {
    case "fast_wrong":
      return "Sector time: quick — you were off the throttle too early on this one.";
    case "slow_wrong":
      return "Sector time: long — you burned laps and still missed the apex.";
    default:
      return "";
  }
}

/** Deterministic, offline, never-blank explanation grounded in the item. */
function placeholderExplain(input: ExplainInput): string {
  const correct = input.choices[input.correctIndex] ?? "the correct option";
  const correctLetter = LETTERS[input.correctIndex] ?? "?";
  const picked =
    input.pickedIndex >= 0 ? input.choices[input.pickedIndex] : null;
  const pickedLetter =
    input.pickedIndex >= 0 ? LETTERS[input.pickedIndex] ?? "?" : null;

  const lines: string[] = [];
  lines.push(
    `The apex here is ${correctLetter} — "${correct}".` +
      (input.topic ? ` Topic: ${input.topic}.` : ""),
  );
  if (input.explanation && input.explanation.trim()) {
    lines.push(input.explanation.trim());
  }
  if (picked) {
    lines.push(
      `You went for ${pickedLetter} — "${picked}". That's the line that cost you the corner.`,
    );
  } else {
    lines.push("You left this one unanswered — no lap logged.");
  }
  const t = timingLine(input.timingCategory);
  if (t) lines.push(t);
  const note = input.errorType ? TELEMETRY_NOTE[input.errorType] : undefined;
  if (note) lines.push(note);
  return lines.join("\n\n");
}

// ---------------------------------------------------------------------------
// Prompt for real providers.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the race engineer for a medical-exam training team. A driver (student) just got a question wrong in a practice race. Debrief them like an F1 race engineer on the pit wall: calm, precise, direct, encouraging but honest.

Rules:
- Explain WHY the correct answer is right and WHY their pick is wrong.
- Ground everything ONLY in the provided explanation and options. NEVER invent new medical facts, numbers, or guidelines.
- If telemetry about their mistake type is provided, work one short piece of study advice from it into the debrief.
- 3-5 short sentences. No preamble, no headings, no markdown. Plain prose.
- A little racing metaphor is welcome but keep the medicine accurate and front and centre.`;

function buildUserPrompt(input: ExplainInput): string {
  const opts = input.choices
    .map((c, i) => {
      const tags = [
        i === input.correctIndex ? "CORRECT" : null,
        i === input.pickedIndex ? "DRIVER PICKED" : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `${LETTERS[i]}. ${c}${tags ? `  [${tags}]` : ""}`;
    })
    .join("\n");

  const telemetry = [
    input.timingCategory ? `timing: ${input.timingCategory}` : null,
    input.errorType ? `classified error: ${input.errorType}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  return [
    input.lectureName ? `Lecture: ${input.lectureName}` : null,
    input.topic ? `Topic: ${input.topic}` : null,
    `Question: ${input.stem}`,
    `Options:\n${opts}`,
    input.explanation ? `Official explanation (ground truth): ${input.explanation}` : null,
    telemetry ? `Telemetry: ${telemetry}` : null,
    "Debrief the driver.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function openAiExplain(input: ExplainInput, apiKey: string): Promise<ExplainResult> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned no content");
  return { provider: "openai", model, text };
}

async function anthropicExplain(
  input: ExplainInput,
  apiKey: string,
): Promise<ExplainResult> {
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      temperature: 0.5,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const json = (await res.json()) as { content?: { text?: string }[] };
  const text = json.content?.map((b) => b.text ?? "").join("").trim();
  if (!text) throw new Error("Anthropic returned no content");
  return { provider: "anthropic", model, text };
}

/**
 * Explain one wrong answer. Selection mirrors the variation system:
 * explicit override, else key auto-detection, else the offline placeholder.
 * Any provider failure falls back to the placeholder so the driver always
 * gets a debrief.
 */
export async function explainMistake(input: ExplainInput): Promise<ExplainResult> {
  const forced = process.env.ENGINEER_PROVIDER?.toLowerCase();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const fallback = (): ExplainResult => ({
    provider: "placeholder",
    model: null,
    text: placeholderExplain(input),
  });

  try {
    if (forced === "placeholder") return fallback();
    if (forced === "anthropic" && anthropicKey)
      return await anthropicExplain(input, anthropicKey);
    if (forced === "openai" && openaiKey)
      return await openAiExplain(input, openaiKey);
    if (!forced) {
      if (anthropicKey) return await anthropicExplain(input, anthropicKey);
      if (openaiKey) return await openAiExplain(input, openaiKey);
    }
  } catch {
    // Provider hiccup — never leave the driver without a debrief.
    return fallback();
  }
  return fallback();
}
