import type { ErrorType, TimingCategory } from "@/lib/telemetry/types";

/**
 * Answer explanation — an on-demand "why did I get this wrong" write-up for a
 * single question. Reuses the same provider seam as the variation system
 * (placeholder by default, OpenAI or Anthropic when a key is present) but
 * returns plain prose, not JSON. Grounded in the question's own explanation
 * field and the runner's telemetry — it never invents new medical facts, and
 * reads as a normal, clear explanation (no metaphors).
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
    "You chose a tempting but less-correct option. Before committing, check whether a finding is specific to the diagnosis or just commonly associated with it.",
  overthinking_error:
    "You changed your answer more than once. Your first read is often right — commit to it unless you have a clear reason to switch.",
  timing_error:
    "You answered very quickly. Give this type of question a little more time to read it fully.",
  recall_error:
    "This is a fact you didn't have ready. Review it and re-test yourself on it.",
  mechanism_error:
    "You reasoned it through and still missed. Go back over the underlying cause-and-effect pathway.",
  frame_error:
    "You misread what the question was asking. Re-read the scenario and identify the actual question before answering.",
  integration_error:
    "This question links two concepts. Study how they connect, not just each one on its own.",
  confidence_error:
    "You were confident but wrong — the costliest kind of error. Review this topic before you rely on it in the exam.",
};

function timingLine(cat: TimingCategory | null): string {
  switch (cat) {
    case "fast_wrong":
      return "You answered quickly and missed it, so slow down and read the whole question next time.";
    case "slow_wrong":
      return "You spent a long time and still missed it, which suggests this concept needs more review.";
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
    `The correct answer is ${correctLetter} — "${correct}".` +
      (input.topic ? ` (${input.topic})` : ""),
  );
  if (input.explanation && input.explanation.trim()) {
    lines.push(input.explanation.trim());
  }
  if (picked) {
    lines.push(
      `You chose ${pickedLetter} — "${picked}", which isn't the best answer here.`,
    );
  } else {
    lines.push("You left this question unanswered.");
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

const SYSTEM_PROMPT = `You are a medical tutor helping a student understand a question they just got wrong on a practice exam. Be calm, precise, direct, and encouraging.

Rules:
- Explain clearly WHY the correct answer is right and WHY the answer they chose is wrong.
- Ground everything ONLY in the provided explanation and options. NEVER invent new medical facts, numbers, or guidelines.
- If information about their mistake pattern is provided, add one short, practical piece of study advice based on it.
- 3-5 short sentences. Plain prose — no preamble, no headings, no markdown, no metaphors.`;

function buildUserPrompt(input: ExplainInput): string {
  const opts = input.choices
    .map((c, i) => {
      const tags = [
        i === input.correctIndex ? "CORRECT" : null,
        i === input.pickedIndex ? "STUDENT CHOSE" : null,
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
    telemetry ? `Mistake pattern: ${telemetry}` : null,
    "Explain why the student's answer was wrong.",
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
 * Any provider failure falls back to the placeholder so the student always
 * gets an explanation.
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
    // Provider hiccup — never leave the student without an explanation.
    return fallback();
  }
  return fallback();
}
