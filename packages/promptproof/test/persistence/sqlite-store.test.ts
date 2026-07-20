import { afterEach, describe, expect, it } from 'vitest';
import { SqliteRunStore } from '../../src/persistence/sqlite-store.js';
import type { SuiteRunResult } from '../../src/core/results.js';

function makeResult(overrides: Partial<SuiteRunResult> = {}): SuiteRunResult {
  return {
    suiteName: 'my-suite',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    durationMs: 1000,
    cases: [],
    aggregates: {
      total: 2,
      passed: 2,
      failed: 0,
      passRate: 1,
      meanLatencyMs: 120,
      p95LatencyMs: 150,
      totalCostUsd: 0.002,
      byGrader: [],
    },
    thresholdResult: { pass: true, failures: [] },
    ...overrides,
  };
}

describe('SqliteRunStore', () => {
  let store: SqliteRunStore;

  afterEach(() => {
    store.close();
  });

  it('saves a run and returns a fully populated record', () => {
    store = new SqliteRunStore(':memory:');
    const result = makeResult({ suiteVersion: 'v1.2.3' });

    const record = store.saveRun(result);

    expect(record.id).toBe(1);
    expect(record.suiteName).toBe('my-suite');
    expect(record.suiteVersion).toBe('v1.2.3');
    expect(record.total).toBe(2);
    expect(record.passed).toBe(2);
    expect(record.passRate).toBe(1);
    expect(record.totalCostUsd).toBe(0.002);
    expect(record.thresholdPass).toBe(true);
    expect(record.result).toEqual(result);
    expect(record.createdAt).toBeTruthy();
  });

  it('stores a null suiteVersion and totalCostUsd when absent', () => {
    store = new SqliteRunStore(':memory:');
    const result = makeResult({
      aggregates: {
        total: 1,
        passed: 0,
        failed: 1,
        passRate: 0,
        meanLatencyMs: 10,
        p95LatencyMs: 10,
        byGrader: [],
      },
      thresholdResult: { pass: false, failures: [] },
    });

    const record = store.saveRun(result);

    expect(record.suiteVersion).toBeNull();
    expect(record.totalCostUsd).toBeNull();
    expect(record.thresholdPass).toBe(false);
  });

  it('lists runs for a suite, most recent first', () => {
    store = new SqliteRunStore(':memory:');
    store.saveRun(makeResult({ suiteVersion: 'v1' }));
    store.saveRun(makeResult({ suiteVersion: 'v2' }));
    store.saveRun(makeResult({ suiteName: 'other-suite', suiteVersion: 'v99' }));

    const runs = store.listRuns('my-suite');

    expect(runs).toHaveLength(2);
    expect(runs[0]?.suiteVersion).toBe('v2');
    expect(runs[1]?.suiteVersion).toBe('v1');
  });

  it('respects the listRuns limit', () => {
    store = new SqliteRunStore(':memory:');
    for (let i = 0; i < 5; i++) store.saveRun(makeResult());

    expect(store.listRuns('my-suite', 3)).toHaveLength(3);
  });

  it('returns an empty array for a suite with no runs', () => {
    store = new SqliteRunStore(':memory:');
    expect(store.listRuns('nonexistent')).toEqual([]);
  });

  it('returns the latest run for a suite', () => {
    store = new SqliteRunStore(':memory:');
    store.saveRun(makeResult({ suiteVersion: 'v1' }));
    const latest = store.saveRun(makeResult({ suiteVersion: 'v2' }));

    expect(store.getLatestRun('my-suite')).toEqual(latest);
  });

  it('returns undefined when there is no run for the suite', () => {
    store = new SqliteRunStore(':memory:');
    expect(store.getLatestRun('nonexistent')).toBeUndefined();
  });
});
