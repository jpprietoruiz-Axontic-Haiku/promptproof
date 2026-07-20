import { describe, expect, it } from 'vitest';
import { semanticSimilarity } from '../../src/graders/semantic-similarity.js';
import type { GraderContext, SuiteCase } from '../../src/core/types.js';

function ctx(output: string, expected?: string): GraderContext<unknown, string> {
  const suiteCase: SuiteCase<unknown, string> = {
    id: 'c1',
    input: 'irrelevant',
    ...(expected !== undefined ? { expected } : {}),
  };
  return { case: suiteCase, output, latencyMs: 1 };
}

describe('semanticSimilarity', () => {
  it('passes when the texts are identical', async () => {
    const result = await semanticSimilarity().grade(
      ctx('the cat sat on the mat', 'the cat sat on the mat'),
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBeCloseTo(1);
  });

  it('scores completely disjoint texts as 0 and fails', async () => {
    const result = await semanticSimilarity().grade(
      ctx('alpha beta gamma', 'delta epsilon zeta'),
    );
    expect(result.score).toBe(0);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('below threshold');
  });

  it('respects a custom threshold', async () => {
    const lenient = await semanticSimilarity({ threshold: 0.1 }).grade(
      ctx('the cat sat', 'the cat ran'),
    );
    const strict = await semanticSimilarity({ threshold: 0.99 }).grade(
      ctx('the cat sat', 'the cat ran'),
    );
    expect(lenient.pass).toBe(true);
    expect(strict.pass).toBe(false);
  });

  it('fails when the case has no expected value', async () => {
    const result = await semanticSimilarity().grade(ctx('hello'));
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('no `expected` value');
  });

  it('uses a custom embedder when provided', async () => {
    const embeddings: Record<string, number[]> = {
      output: [1, 0],
      expected: [0, 1],
    };
    const embedder = (text: string): number[] => embeddings[text] ?? [0, 0];

    const result = await semanticSimilarity({ embedder }).grade(
      ctx('output', 'expected'),
    );
    expect(result.score).toBe(0);
  });

  it('supports an async embedder', async () => {
    const embedder = async (text: string): Promise<number[]> =>
      Promise.resolve(text === 'output' ? [1, 1] : [1, 1]);

    const result = await semanticSimilarity({ embedder }).grade(
      ctx('output', 'expected'),
    );
    expect(result.score).toBeCloseTo(1);
  });
});
