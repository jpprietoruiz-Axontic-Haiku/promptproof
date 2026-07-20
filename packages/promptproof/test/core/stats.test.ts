import { describe, expect, it } from 'vitest';
import { mean, percentile } from '../../src/core/stats.js';

describe('mean', () => {
  it('returns 0 for an empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('averages the values', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('percentile', () => {
  it('returns 0 for an empty array', () => {
    expect(percentile([], 95)).toBe(0);
  });

  it('returns the single value when there is only one', () => {
    expect(percentile([42], 95)).toBe(42);
  });

  it('computes p95 using nearest-rank on sorted values', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(percentile(values, 95)).toBe(95);
  });

  it('is insensitive to input order', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(percentile([1, 2, 3, 4, 5], 50));
  });
});
