import {
  parseAiVariationResponse,
  type AiVariationResponse,
  type BaseQuestion,
  type GenerateOptions,
} from "./types";
import { selectProvider, type VariationProvider } from "./providers";

/**
 * The public entry point. Accepts a base question, asks the configured provider
 * for variants, and validates the payload against the strict JSON contract
 * before returning. Nothing malformed ever escapes this boundary.
 */

export interface GenerateResult {
  provider: string;
  model: string | null;
  data: AiVariationResponse;
}

export async function generateVariants(
  base: BaseQuestion,
  opts: GenerateOptions = {},
  provider: VariationProvider = selectProvider(),
): Promise<GenerateResult> {
  let raw: unknown;
  try {
    raw = await provider.generate(base, opts);
  } catch (err) {
    throw new VariationError(
      `provider "${provider.name}" failed: ${(err as Error).message}`,
    );
  }

  const parsed = parseAiVariationResponse(raw);
  if (!parsed.ok) {
    throw new VariationError(
      `provider "${provider.name}" returned invalid JSON: ${parsed.error}`,
    );
  }

  // If specific angles were requested, keep only those (a real model may drift).
  const wanted = opts.angles?.length ? new Set(opts.angles) : null;
  const variants = wanted
    ? parsed.data.variants.filter((v) => wanted.has(v.angle))
    : parsed.data.variants;

  if (variants.length === 0) {
    throw new VariationError("no variants matched the requested angles");
  }

  return {
    provider: provider.name,
    model: provider.model,
    data: { ...parsed.data, variants },
  };
}

export class VariationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VariationError";
  }
}

export { selectProvider } from "./providers";
