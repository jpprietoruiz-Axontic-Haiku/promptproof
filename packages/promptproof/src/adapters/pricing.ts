import type { CostInfo } from '../core/types.js';

/**
 * Per-million-token pricing. Model prices change often and vary by provider
 * agreement, so PromptProof never bakes in a pricing table — pass one
 * explicitly to an adapter to get `cost.totalCostUsd` populated.
 */
export interface TokenPricing {
  readonly inputPerMillionUsd: number;
  readonly outputPerMillionUsd: number;
}

/**
 * Builds a {@link CostInfo} from raw token counts. Returns `undefined` when
 * neither count is available (nothing to report).
 */
export function computeCost(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  pricing: TokenPricing | undefined,
): CostInfo | undefined {
  if (inputTokens === undefined && outputTokens === undefined) {
    return undefined;
  }

  const totalCostUsd =
    pricing && inputTokens !== undefined && outputTokens !== undefined
      ? (inputTokens / 1_000_000) * pricing.inputPerMillionUsd +
        (outputTokens / 1_000_000) * pricing.outputPerMillionUsd
      : undefined;

  return {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalCostUsd !== undefined ? { totalCostUsd } : {}),
  };
}
