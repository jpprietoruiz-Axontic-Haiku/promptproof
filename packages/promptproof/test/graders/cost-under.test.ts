import { describe, expect, it } from 'vitest';
import { costUnder } from '../../src/graders/cost-under.js';
import type { CostInfo, GraderContext, SuiteCase } from '../../src/core/types.js';

function ctx(cost?: CostInfo): GraderContext {
  const suiteCase: SuiteCase = { id: 'c1', input: 'irrelevant' };
  return { case: suiteCase, output: 'x', latencyMs: 1, ...(cost ? { cost } : {}) };
}

describe('costUnder', () => {
  it('has the default name', () => {
    expect(costUnder(0.01).name).toBe('costUnder');
  });

  it('passes when cost is under the limit', async () => {
    const result = await costUnder(0.01).grade(ctx({ totalCostUsd: 0.005 }));
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails when cost exceeds the limit, with a helpful reason', async () => {
    const result = await costUnder(0.01).grade(ctx({ totalCostUsd: 0.02 }));
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain('0.01');
  });

  it('fails when no cost data is available', async () => {
    const result = await costUnder(0.01).grade(ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('No cost data');
  });

  it('fails when cost is reported without totalCostUsd', async () => {
    const result = await costUnder(0.01).grade(ctx({ inputTokens: 10, outputTokens: 5 }));
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('No cost data');
  });
});
