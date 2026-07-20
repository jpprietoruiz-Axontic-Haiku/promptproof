import { describe, expect, it } from 'vitest';
import { computeCost } from '../../src/adapters/pricing.js';

describe('computeCost', () => {
  it('returns undefined when no token counts are available', () => {
    expect(computeCost(undefined, undefined, undefined)).toBeUndefined();
  });

  it('reports token counts without totalCostUsd when pricing is omitted', () => {
    expect(computeCost(100, 50, undefined)).toEqual({
      inputTokens: 100,
      outputTokens: 50,
    });
  });

  it('computes totalCostUsd from per-million pricing', () => {
    const cost = computeCost(1_000_000, 1_000_000, {
      inputPerMillionUsd: 3,
      outputPerMillionUsd: 15,
    });
    expect(cost).toEqual({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      totalCostUsd: 18,
    });
  });

  it('omits totalCostUsd when only one token count is known, even with pricing', () => {
    const cost = computeCost(100, undefined, {
      inputPerMillionUsd: 3,
      outputPerMillionUsd: 15,
    });
    expect(cost).toEqual({ inputTokens: 100 });
  });
});
