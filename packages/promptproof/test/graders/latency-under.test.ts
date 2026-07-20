import { describe, expect, it } from 'vitest';
import { latencyUnder } from '../../src/graders/latency-under.js';
import type { GraderContext, SuiteCase } from '../../src/core/types.js';

function ctx(latencyMs: number): GraderContext {
  const suiteCase: SuiteCase = { id: 'c1', input: 'irrelevant' };
  return { case: suiteCase, output: 'x', latencyMs };
}

describe('latencyUnder', () => {
  it('has the default name', () => {
    expect(latencyUnder(1000).name).toBe('latencyUnder');
  });

  it('passes when latency is under the limit', async () => {
    const result = await latencyUnder(1000).grade(ctx(500));
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('passes when latency exactly equals the limit', async () => {
    const result = await latencyUnder(1000).grade(ctx(1000));
    expect(result.pass).toBe(true);
  });

  it('fails when latency exceeds the limit, with a helpful reason', async () => {
    const result = await latencyUnder(1000).grade(ctx(1500));
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain('1000ms');
  });
});
