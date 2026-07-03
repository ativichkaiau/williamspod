import {
  ANGLE_META,
  QUESTION_ANGLES,
  type AiVariationResponse,
  type BaseQuestion,
  type GenerateOptions,
  type QuestionAngle,
} from "./types";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";

/**
 * A provider turns a base question into raw (unvalidated) JSON. The service
 * layer validates the result against the strict Zod contract — providers are
 * never trusted directly.
 */
export interface VariationProvider {
  readonly name: string;
  readonly model: string | null;
  generate(base: BaseQuestion, opts: GenerateOptions): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Placeholder provider — deterministic, offline, zero-config default.
// ---------------------------------------------------------------------------

/**
 * Produces a structurally-valid variant per requested angle by re-framing the
 * base question. It intentionally does NOT invent new medical facts: it reuses
 * the base's own correct answer and choices, only changing the *framing* of the
 * prompt per angle. This makes the whole pipeline work with no API key and
 * gives a safe fallback. It is clearly labelled "placeholder" in the UI.
 */
export class PlaceholderProvider implements VariationProvider {
  readonly name = "placeholder";
  readonly model = null;

  async generate(
    base: BaseQuestion,
    opts: GenerateOptions,
  ): Promise<AiVariationResponse> {
    const angles = opts.angles?.length
      ? opts.angles
      : ([...QUESTION_ANGLES] as QuestionAngle[]);
    const correct = base.choices[base.correctIndex] ?? "the correct finding";
    const topic = (base.topic?.trim() || "this condition").slice(0, 200);

    // Guarantee a valid learning objective even when the base explanation is
    // empty/whitespace (its first "sentence" would otherwise be zero-length).
    const explanation = (base.explanation ?? "").trim();
    const firstSentence = explanation
      ? explanation.split(/(?<=[.!?])\s/)[0] ?? ""
      : "";
    const learningObjective = clamp(
      firstSentence.length >= 3
        ? firstSentence
        : `Recognise the concept tested by this ${topic} question.`,
      600,
    );

    const variants = angles.map((angle) => {
      // Keep the same option set + correct answer → never alters medical truth.
      return {
        angle,
        difficulty:
          angle === "trap" || angle === "integration"
            ? ("harder" as const)
            : angle === "recall"
              ? ("easier" as const)
              : ("same" as const),
        stem: clamp(reframe(angle, base, topic), 4000),
        choices: base.choices,
        correctIndex: base.correctIndex,
        explanation: clamp(
          explanation ||
            `The correct answer is "${correct}" — the same concept as the original item, framed from a ${ANGLE_META[angle].label.toLowerCase()} angle.`,
          8000,
        ),
        conceptTag: topic,
      };
    });

    return { learningObjective, variants };
  }
}

/** Trim to a max length so placeholder output always satisfies the contract. */
function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function reframe(angle: QuestionAngle, base: BaseQuestion, topic: string): string {
  const s = base.stem.replace(/\s+/g, " ").trim();
  switch (angle) {
    case "recall":
      return `Regarding ${topic}: ${s}`;
    case "mechanism":
      return `What is the underlying mechanism that explains the answer to: ${s}`;
    case "clinical_vignette":
      return `A patient presents with features consistent with ${topic}. ${s}`;
    case "physical_exam":
      return `Which physical examination finding is most expected in this scenario? ${s}`;
    case "diagnosis":
      return `Based on the clinical picture, what is the most likely diagnosis? ${s}`;
    case "management":
      return `What is the most immediate clinical priority in this case? ${s}`;
    case "trap":
      return `Which finding is MORE SPECIFIC (not merely more common) in this case? ${s}`;
    case "integration":
      return `Connect the primary lesion to its downstream consequence in this case. ${s}`;
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider (also works with any OpenAI-compatible endpoint).
// ---------------------------------------------------------------------------

export class OpenAiProvider implements VariationProvider {
  readonly name = "openai";
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    this.baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  }

  async generate(base: BaseQuestion, opts: GenerateOptions): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(base, opts) },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${await res.text().catch(() => "")}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned no content");
    return JSON.parse(content);
  }
}

// ---------------------------------------------------------------------------
// Anthropic (Claude) provider.
// ---------------------------------------------------------------------------

export class AnthropicProvider implements VariationProvider {
  readonly name = "anthropic";
  readonly model: string;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  }

  async generate(base: BaseQuestion, opts: GenerateOptions): Promise<unknown> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        temperature: 0.8,
        system: SYSTEM_PROMPT + "\n\nRespond with a single JSON object and nothing else.",
        messages: [{ role: "user", content: buildUserPrompt(base, opts) }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${await res.text().catch(() => "")}`);
    }
    const json = (await res.json()) as { content?: { text?: string }[] };
    const text = json.content?.map((b) => b.text ?? "").join("").trim();
    if (!text) throw new Error("Anthropic returned no content");
    // Be tolerant of an accidental code fence.
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
    return JSON.parse(cleaned);
  }
}

// ---------------------------------------------------------------------------
// Selection: explicit override, then key auto-detection, else placeholder.
// ---------------------------------------------------------------------------

export function selectProvider(): VariationProvider {
  const forced = process.env.VARIATION_PROVIDER?.toLowerCase();
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (forced === "placeholder") return new PlaceholderProvider();
  if (forced === "openai" && openaiKey) return new OpenAiProvider(openaiKey);
  if (forced === "anthropic" && anthropicKey)
    return new AnthropicProvider(anthropicKey);

  // Auto: prefer Claude, then OpenAI, else the offline placeholder.
  if (!forced) {
    if (anthropicKey) return new AnthropicProvider(anthropicKey);
    if (openaiKey) return new OpenAiProvider(openaiKey);
  }
  return new PlaceholderProvider();
}
