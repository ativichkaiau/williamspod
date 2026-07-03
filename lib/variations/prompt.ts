import {
  ANGLE_META,
  QUESTION_ANGLES,
  type BaseQuestion,
  type GenerateOptions,
  type QuestionAngle,
} from "./types";

/**
 * Builds the system + user prompts for variant generation. The prompt is the
 * safety layer: it hard-constrains the model to preserve the learning
 * objective and medical truth, and to emit ONLY strict JSON.
 */

export const SYSTEM_PROMPT = `You are a medical exam item-writer for WilliamsPod, a high-pressure exam training simulator. You rewrite a single board-style multiple-choice question into VARIANTS that test the SAME underlying concept from different cognitive angles, so a student cannot pass by memorising the original stem.

Absolute rules:
1. PRESERVE the original learning objective and the correct medical concept. Every variant must still hinge on the same core idea.
2. NEVER change medical truth. Do not invent findings, drugs, doses, or associations that are not correct. If unsure, stay conservative and standard-of-care.
3. Each variant must be self-contained, unambiguous, and have exactly ONE best answer.
4. Distractors must be plausible (common confusions), not nonsense.
5. Vary the framing/angle and surface wording heavily — do NOT reuse the original stem's sentences.
6. Output STRICT JSON ONLY. No prose, no markdown, no code fences. It must parse with JSON.parse.

Return an object of this exact shape:
{
  "learningObjective": string,          // the preserved concept, one sentence
  "variants": [
    {
      "angle": one of ${JSON.stringify(QUESTION_ANGLES)},
      "difficulty": "easier" | "same" | "harder",
      "stem": string,                   // the question, no answer leakage
      "choices": string[],              // 4-5 options, plausible distractors
      "correctIndex": number,           // 0-based index of the correct choice
      "explanation": string,            // why correct is correct; 1-3 sentences
      "conceptTag": string              // short concept link, e.g. "aortic root -> AR"
    }
  ]
}`;

function angleLine(a: QuestionAngle): string {
  return `- ${a}: ${ANGLE_META[a].blurb}`;
}

export function buildUserPrompt(
  base: BaseQuestion,
  opts: GenerateOptions = {},
): string {
  const angles = opts.angles?.length ? opts.angles : [...QUESTION_ANGLES];
  const correct = base.choices[base.correctIndex] ?? "(unknown)";
  const lines: string[] = [];

  lines.push("ORIGINAL QUESTION (source of truth — do not contradict it):");
  lines.push(`Stem: ${base.stem}`);
  lines.push("Choices:");
  base.choices.forEach((c, i) => {
    lines.push(`  ${String.fromCharCode(65 + i)}. ${c}${i === base.correctIndex ? "  [correct]" : ""}`);
  });
  lines.push(`Correct answer: ${correct}`);
  if (base.explanation) lines.push(`Explanation: ${base.explanation}`);
  if (base.topic) lines.push(`Topic: ${base.topic}`);
  if (base.difficulty != null)
    lines.push(`Base difficulty (1 easy – 3 hard): ${base.difficulty}`);

  lines.push("");
  lines.push(
    `Produce exactly ${angles.length} variant(s), one for EACH of these angles, in this order:`,
  );
  angles.forEach((a) => lines.push(angleLine(a)));

  if (opts.guidance?.trim()) {
    lines.push("");
    lines.push(`Additional guidance: ${opts.guidance.trim()}`);
  }

  lines.push("");
  lines.push(
    "Remember: same concept, different angle, medically accurate, strict JSON only.",
  );
  return lines.join("\n");
}
