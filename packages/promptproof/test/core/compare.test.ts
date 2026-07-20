import { describe, expect, it } from 'vitest';
import { compareRuns } from '../../src/core/compare.js';
import type { SuiteRunResult } from '../../src/core/results.js';

function makeRun(overrides: Partial<SuiteRunResult['aggregates']> = {}): SuiteRunResult {
  return {
    suiteName: 's',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    durationMs: 1000,
    cases: [],
    aggregates: {
      total: 10,
      passed: 10,
      failed: 0,
      passRate: 1,
      meanLatencyMs: 100,
      p95LatencyMs: 150,
      byGrader: [
        {
          grader: 'exactMatch',
          total: 10,
          passed: 10,
          failed: 0,
          passRate: 1,
          meanScore: 1,
        },
      ],
      ...overrides,
    },
    thresholdResult: { pass: true, failures: [] },
  };
}

describe('compareRuns', () => {
  it('reports no regression when metrics are identical', () => {
    const baseline = makeRun();
    const current = makeRun();

    const report = compareRuns(baseline, current);
    expect(report.regressed).toBe(false);
  });

  it('flags any drop in overall pass rate by default', () => {
    const baseline = makeRun({ passRate: 1 });
    const current = makeRun({ passRate: 0.9 });

    const report = compareRuns(baseline, current);
    expect(report.regressed).toBe(true);
    const check = report.checks.find((c) => c.metric === 'passRate');
    expect(check?.regressed).toBe(true);
    expect(check?.message).toContain('dropped from 100.0% to 90.0%');
  });

  it('does not flag an improvement in pass rate', () => {
    const baseline = makeRun({ passRate: 0.8 });
    const current = makeRun({ passRate: 0.9 });

    expect(compareRuns(baseline, current).regressed).toBe(false);
  });

  it('respects a configured maxPassRateDrop tolerance', () => {
    const baseline = makeRun({ passRate: 1 });
    const current = makeRun({ passRate: 0.97 });

    expect(compareRuns(baseline, current, { maxPassRateDrop: 0.05 }).regressed).toBe(
      false,
    );
    expect(compareRuns(baseline, current, { maxPassRateDrop: 0.01 }).regressed).toBe(
      true,
    );
  });

  it('does not check latency by default', () => {
    const baseline = makeRun({ meanLatencyMs: 100 });
    const current = makeRun({ meanLatencyMs: 10_000 });

    expect(compareRuns(baseline, current).regressed).toBe(false);
  });

  it('flags a latency regression when maxLatencyIncreasePct is set', () => {
    const baseline = makeRun({ meanLatencyMs: 100 });
    const current = makeRun({ meanLatencyMs: 200 });

    const report = compareRuns(baseline, current, { maxLatencyIncreasePct: 0.5 });
    expect(report.regressed).toBe(true);
    const check = report.checks.find((c) => c.metric === 'meanLatencyMs');
    expect(check?.message).toContain('increased 100.0%');
  });

  it('does not flag a latency improvement', () => {
    const baseline = makeRun({ meanLatencyMs: 200 });
    const current = makeRun({ meanLatencyMs: 100 });

    expect(compareRuns(baseline, current, { maxLatencyIncreasePct: 0.1 }).regressed).toBe(
      false,
    );
  });

  it('handles a zero baseline latency without dividing by zero', () => {
    const baseline = makeRun({ meanLatencyMs: 0 });
    const currentZero = makeRun({ meanLatencyMs: 0 });
    const currentPositive = makeRun({ meanLatencyMs: 50 });

    expect(
      compareRuns(baseline, currentZero, { maxLatencyIncreasePct: 0.1 }).regressed,
    ).toBe(false);
    expect(
      compareRuns(baseline, currentPositive, { maxLatencyIncreasePct: 0.1 }).regressed,
    ).toBe(true);
  });

  it('flags a cost regression only when both runs report cost and the threshold is set', () => {
    const baseline = makeRun({ totalCostUsd: 1 });
    const current = makeRun({ totalCostUsd: 2 });

    expect(compareRuns(baseline, current).regressed).toBe(false);
    expect(compareRuns(baseline, current, { maxCostIncreasePct: 0.5 }).regressed).toBe(
      true,
    );
  });

  it('skips the cost check when either run has no cost data', () => {
    const baseline = makeRun({ totalCostUsd: 1 });
    const current = makeRun(); // no totalCostUsd

    const report = compareRuns(baseline, current, { maxCostIncreasePct: 0.1 });
    expect(report.checks.some((c) => c.metric === 'totalCostUsd')).toBe(false);
  });

  it('flags a per-grader pass-rate regression when configured', () => {
    const baseline = makeRun({
      byGrader: [
        { grader: 'faithfulness', total: 10, passed: 10, failed: 0, passRate: 1 },
      ],
    });
    const current = makeRun({
      byGrader: [
        { grader: 'faithfulness', total: 10, passed: 8, failed: 2, passRate: 0.8 },
      ],
    });

    const report = compareRuns(baseline, current, {
      graders: { faithfulness: { maxPassRateDrop: 0.1 } },
    });
    expect(report.regressed).toBe(true);
    expect(
      report.checks.find((c) => c.metric === 'faithfulness.passRate')?.regressed,
    ).toBe(true);
  });

  it('flags a per-grader mean-score regression when configured', () => {
    const baseline = makeRun({
      byGrader: [
        {
          grader: 'llmJudge',
          total: 10,
          passed: 10,
          failed: 0,
          passRate: 1,
          meanScore: 0.9,
        },
      ],
    });
    const current = makeRun({
      byGrader: [
        {
          grader: 'llmJudge',
          total: 10,
          passed: 10,
          failed: 0,
          passRate: 1,
          meanScore: 0.6,
        },
      ],
    });

    const report = compareRuns(baseline, current, {
      graders: { llmJudge: { maxMeanScoreDrop: 0.1 } },
    });
    expect(report.regressed).toBe(true);
  });

  it('ignores a grader threshold for a grader missing from either run', () => {
    const baseline = makeRun({ byGrader: [] });
    const current = makeRun({ byGrader: [] });

    const report = compareRuns(baseline, current, {
      graders: { nonexistent: { maxPassRateDrop: 0 } },
    });
    expect(report.checks).toHaveLength(1); // only the always-on passRate check
    expect(report.regressed).toBe(false);
  });
});
