import { z } from "zod";

/**
 * WilliamsPod — question variation system.
 *
 * A BaseQuestion (from the shared bank) can spawn many QuestionVariants that
 * probe the SAME underlying concept from different angles, so a runner cannot
 * memorise repeated stems. Variants preserve the original learning objective
 * and never alter medical truth — only the framing/angle changes.
 *
 * This module is intentionally self-contained and additive; it does not modify
 * the existing question/attempt models.
 */

// ---------------------------------------------------------------------------
// Angles & difficulty
// ---------------------------------------------------------------------------

/** The eight cognitive angles a variant can take on the same concept. */
export const QUESTION_ANGLES = [
  "recall",
  "mechanism",
  "clinical_vignette",
  "physical_exam",
  "diagnosis",
  "management",
  "trap",
  "integration",
] as const;

export type QuestionAngle = (typeof QUESTION_ANGLES)[number];

/** Human-facing metadata for each angle (labels, blurbs, tone). */
export const ANGLE_META: Record<
  QuestionAngle,
  { label: string; blurb: string }
> = {
  recall: {
    label: "Recall",
    blurb: "Direct retrieval of the core fact.",
  },
  mechanism: {
    label: "Mechanism",
    blurb: "Why / how the pathophysiology produces the finding.",
  },
  clinical_vignette: {
    label: "Clinical vignette",
    blurb: "A patient scenario that leads to the same concept.",
  },
  physical_exam: {
    label: "Physical exam",
    blurb: "The expected examination finding or sign.",
  },
  diagnosis: {
    label: "Diagnosis",
    blurb: "Identify the underlying condition from clues.",
  },
  management: {
    label: "Management",
    blurb: "The immediate priority or next best step.",
  },
  trap: {
    label: "Trap",
    blurb: "Distinguishes a specific finding from a tempting distractor.",
  },
  integration: {
    label: "Integration",
    blurb: "Connects two systems/concepts around the same lesion.",
  },
};

/** How the variant's difficulty relates to the base question. */
export const VARIATION_DIFFICULTIES = ["easier", "same", "harder"] as const;
export type VariationDifficulty = (typeof VARIATION_DIFFICULTIES)[number];

// ---------------------------------------------------------------------------
// Core shapes
// ---------------------------------------------------------------------------

/** The source-of-truth question a variant is derived from. */
export interface BaseQuestion {
  id: string;
  lectureId: string;
  stem: string;
  choices: string[];
  /** 0-based index into `choices`. */
  correctIndex: number;
  explanation: string | null;
  topic: string | null;
  /** 1 = easy, 2 = medium, 3 = hard (nullable). */
  difficulty: number | null;
}

/** A generated variant, persisted and shown with provenance. */
export interface QuestionVariant {
  id: string;
  /** Provenance — which bank question this was modified from. */
  baseQuestionId: string;
  angle: QuestionAngle;
  difficulty: VariationDifficulty;
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
  /** Preserved from the base — the concept the variant must still test. */
  learningObjective: string | null;
  /** Short tag naming the concept link (e.g. "aortic root → aortic regurgitation"). */
  conceptTag: string | null;
  /** Which AI provider produced it ("placeholder" | "openai" | "anthropic"). */
  provider: string;
  /** Model id, when a real provider was used. */
  model: string | null;
  createdAt: string; // ISO
}

// ---------------------------------------------------------------------------
// Strict-JSON contract for AI providers
// ---------------------------------------------------------------------------

/**
 * The exact JSON shape a provider must return. Anything not matching this is
 * rejected before it can touch the database — the guardrail against malformed
 * or hallucinated output.
 */
export const AiVariantSchema = z.object({
  angle: z.enum(QUESTION_ANGLES),
  difficulty: z.enum(VARIATION_DIFFICULTIES),
  stem: z.string().min(8).max(4000),
  choices: z.array(z.string().min(1).max(2000)).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  explanation: z.string().max(8000).nullish(),
  conceptTag: z.string().max(200).nullish(),
});

export const AiVariationResponseSchema = z.object({
  /** The preserved learning objective / correct concept of the base question. */
  learningObjective: z.string().min(3).max(600),
  variants: z.array(AiVariantSchema).min(1).max(12),
});

export type AiVariant = z.infer<typeof AiVariantSchema>;
export type AiVariationResponse = z.infer<typeof AiVariationResponseSchema>;

/** Options passed into the service when requesting a generation. */
export interface GenerateOptions {
  /** Restrict to these angles; default = all eight. */
  angles?: QuestionAngle[];
  /** Extra guidance appended to the prompt (e.g. "keep it board-style"). */
  guidance?: string;
}

/**
 * Validate a raw provider payload against the strict contract, additionally
 * enforcing that every variant's correctIndex is in range for its choices.
 * Returns a discriminated result so callers never see partially-valid data.
 */
export function parseAiVariationResponse(
  raw: unknown,
):
  | { ok: true; data: AiVariationResponse }
  | { ok: false; error: string } {
  const parsed = AiVariationResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid shape" };
  }
  for (const v of parsed.data.variants) {
    if (v.correctIndex >= v.choices.length) {
      return {
        ok: false,
        error: `correctIndex ${v.correctIndex} out of range for a ${v.angle} variant`,
      };
    }
  }
  return { ok: true, data: parsed.data };
}
