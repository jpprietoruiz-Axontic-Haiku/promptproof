import { describe, expect, it, vi } from 'vitest';
import { defineSuite } from '../../src/core/define-suite.js';
import { run } from '../../src/core/run.js';
import type { Adapter, Grader } from '../../src/core/types.js';

function makeGrader(name: string, grade: Grader['grade']): Grader {
  return { name, grade };
}

describe('run', () => {
  it('runs every case and reports a passing suite when all graders pass', async () => {
    const suite = defineSuite({
      name: 'basic',
      cases: [
        { id: 'a', input: 'foo', expected: 'foo' },
        { id: 'b', input: 'bar', expected: 'bar' },
      ],
      graders: [
        makeGrader('echo-match', ({ case: c, output }) => ({
          pass: output === c.expected,
        })),
      ],
    });

    const adapter: Adapter<string, string> = (input) => ({ output: input, latencyMs: 5 });

    const result = await run(suite, { adapter });

    expect(result.suiteName).toBe('basic');
    expect(result.cases).toHaveLength(2);
    expect(result.aggregates.passed).toBe(2);
    expect(result.aggregates.passRate).toBe(1);
    expect(result.thresholdResult.pass).toBe(true);
  });

  it('marks a case failed and attaches the error when the adapter throws', async () => {
    const suite = defineSuite({
      name: 'adapter-errors',
      cases: [
        { id: 'ok', input: 'x' },
        { id: 'boom', input: 'x' },
      ],
      graders: [makeGrader('always-pass', () => ({ pass: true }))],
    });

    const adapter: Adapter<string> = (_input, info) => {
      if (info.case.id === 'boom') throw new Error('adapter exploded');
      return { output: 'fine' };
    };

    const result = await run(suite, { adapter });

    const boomResult = result.cases.find((c) => c.case.id === 'boom');
    expect(boomResult?.pass).toBe(false);
    expect(boomResult?.error?.message).toBe('adapter exploded');
    expect(boomResult?.graderResults).toHaveLength(0);

    const okResult = result.cases.find((c) => c.case.id === 'ok');
    expect(okResult?.pass).toBe(true);
    expect(result.aggregates.passed).toBe(1);
    expect(result.aggregates.failed).toBe(1);
  });

  it('serializes a non-Error value thrown by the adapter', async () => {
    const suite = defineSuite({
      name: 'non-error-throw',
      cases: [{ id: 'a', input: 'x' }],
      graders: [makeGrader('always-pass', () => ({ pass: true }))],
    });

    const adapter: Adapter<string> = () => {
      // Intentionally throwing a non-Error to exercise the runner's defensive
      // handling of misbehaving adapters.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'a string was thrown';
    };

    const result = await run(suite, { adapter });
    expect(result.cases[0]?.error).toEqual({
      name: 'UnknownError',
      message: 'a string was thrown',
    });
  });

  it('records a failing grader outcome when a grader throws, without failing other graders', async () => {
    const suite = defineSuite({
      name: 'grader-errors',
      cases: [{ id: 'a', input: 'x' }],
      graders: [
        makeGrader('throws', () => {
          throw new Error('grader exploded');
        }),
        makeGrader('always-pass', () => ({ pass: true })),
      ],
    });

    const adapter: Adapter<string> = () => ({ output: 'y' });
    const result = await run(suite, { adapter });

    const [caseResult] = result.cases;
    const throwing = caseResult?.graderResults.find((g) => g.grader === 'throws');
    const passing = caseResult?.graderResults.find((g) => g.grader === 'always-pass');

    expect(throwing?.pass).toBe(false);
    expect(throwing?.reason).toContain('grader exploded');
    expect(passing?.pass).toBe(true);
    expect(caseResult?.pass).toBe(false);
  });

  it('measures latency itself when the adapter does not report one', async () => {
    const suite = defineSuite({
      name: 'latency',
      cases: [{ id: 'a', input: 'x' }],
      graders: [makeGrader('always-pass', () => ({ pass: true }))],
    });

    const adapter: Adapter<string> = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { output: 'y' };
    };

    const result = await run(suite, { adapter });
    expect(result.cases[0]?.latencyMs).toBeGreaterThanOrEqual(9);
  });

  it('sums per-case cost into aggregates.totalCostUsd', async () => {
    const suite = defineSuite({
      name: 'cost',
      cases: [
        { id: 'a', input: 'x' },
        { id: 'b', input: 'x' },
      ],
      graders: [makeGrader('always-pass', () => ({ pass: true }))],
    });

    const adapter: Adapter<string> = () => ({
      output: 'y',
      cost: { totalCostUsd: 0.01 },
    });

    const result = await run(suite, { adapter });
    expect(result.aggregates.totalCostUsd).toBeCloseTo(0.02);
  });

  it('computes mean score per grader and enforces minMeanScore thresholds', async () => {
    const suite = defineSuite({
      name: 'scored',
      cases: [
        { id: 'a', input: 1 },
        { id: 'b', input: 2 },
      ],
      graders: [
        makeGrader('scorer', ({ case: c }) => ({
          pass: true,
          score: c.id === 'a' ? 1 : 0,
        })),
      ],
      thresholds: { graders: { scorer: { minMeanScore: 0.75 } } },
    });

    const adapter: Adapter<number> = () => ({ output: 'y' });
    const result = await run(suite, { adapter });

    expect(result.aggregates.byGrader[0]?.meanScore).toBe(0.5);
    expect(result.thresholdResult.pass).toBe(false);
    expect(result.thresholdResult.failures[0]?.kind).toBe('grader-mean-score');
  });

  it('fails a per-grader minPassRate threshold', async () => {
    const suite = defineSuite({
      name: 'grader-pass-rate',
      cases: [
        { id: 'a', input: 1 },
        { id: 'b', input: 2 },
      ],
      graders: [makeGrader('parity', ({ case: c }) => ({ pass: c.id === 'a' }))],
      thresholds: { passRate: 0, graders: { parity: { minPassRate: 0.9 } } },
    });

    const adapter: Adapter<number> = () => ({ output: 'y' });
    const result = await run(suite, { adapter });

    expect(result.thresholdResult.pass).toBe(false);
    expect(result.thresholdResult.failures[0]).toMatchObject({
      kind: 'grader-pass-rate',
      grader: 'parity',
      expected: 0.9,
    });
  });

  it('fails the overall pass-rate threshold when not enough cases pass', async () => {
    const suite = defineSuite({
      name: 'gated',
      cases: [
        { id: 'a', input: 1 },
        { id: 'b', input: 2 },
      ],
      graders: [makeGrader('parity', ({ case: c }) => ({ pass: c.id === 'a' }))],
      thresholds: { passRate: 0.9 },
    });

    const adapter: Adapter<number> = () => ({ output: 'y' });
    const result = await run(suite, { adapter });

    expect(result.thresholdResult.pass).toBe(false);
    expect(result.thresholdResult.failures[0]).toMatchObject({
      kind: 'overall-pass-rate',
      expected: 0.9,
    });
  });

  it('invokes onCaseComplete once per case', async () => {
    const suite = defineSuite({
      name: 'callback',
      cases: [
        { id: 'a', input: 1 },
        { id: 'b', input: 2 },
        { id: 'c', input: 3 },
      ],
      graders: [makeGrader('always-pass', () => ({ pass: true }))],
    });

    const adapter: Adapter<number> = () => ({ output: 'y' });
    const onCaseComplete = vi.fn();

    await run(suite, { adapter, onCaseComplete, concurrency: 2 });

    expect(onCaseComplete).toHaveBeenCalledTimes(3);
  });

  it('never runs more than `concurrency` adapter calls at once', async () => {
    const suite = defineSuite({
      name: 'concurrency',
      cases: Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, input: i })),
      graders: [makeGrader('always-pass', () => ({ pass: true }))],
    });

    let active = 0;
    let maxActive = 0;
    const adapter: Adapter<number> = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return { output: 'y' };
    };

    await run(suite, { adapter, concurrency: 2 });
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
