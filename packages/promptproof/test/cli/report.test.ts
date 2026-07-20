import { describe, expect, it } from 'vitest';
import { formatReport } from '../../src/cli/report.js';
import type { SuiteRunResult } from '../../src/core/results.js';

const passingResult: SuiteRunResult = {
  suiteName: 'greeting-suite',
  suiteVersion: 'v1.0.0',
  startedAt: '2026-01-01T00:00:00.000Z',
  finishedAt: '2026-01-01T00:00:01.000Z',
  durationMs: 1000,
  cases: [
    {
      case: { id: 'a', name: 'says hello', input: 'hi' },
      output: 'hello',
      latencyMs: 120,
      graderResults: [{ grader: 'exactMatch', pass: true, score: 1 }],
      pass: true,
    },
  ],
  aggregates: {
    total: 1,
    passed: 1,
    failed: 0,
    passRate: 1,
    meanLatencyMs: 120,
    p95LatencyMs: 120,
    totalCostUsd: 0.0012,
    byGrader: [
      { grader: 'exactMatch', total: 1, passed: 1, failed: 0, passRate: 1, meanScore: 1 },
    ],
  },
  thresholdResult: { pass: true, failures: [] },
};

const failingResult: SuiteRunResult = {
  suiteName: 'greeting-suite',
  startedAt: '2026-01-01T00:00:00.000Z',
  finishedAt: '2026-01-01T00:00:01.000Z',
  durationMs: 500,
  cases: [
    {
      case: { id: 'b', input: 'hi' },
      output: 'bonjour',
      latencyMs: 90,
      graderResults: [
        {
          grader: 'exactMatch',
          pass: false,
          score: 0,
          reason: 'Expected "hi", got "bonjour".',
        },
      ],
      pass: false,
    },
    {
      case: { id: 'c', input: 'hi' },
      graderResults: [],
      pass: false,
      error: { name: 'Error', message: 'adapter timed out' },
    },
  ],
  aggregates: {
    total: 2,
    passed: 0,
    failed: 2,
    passRate: 0,
    meanLatencyMs: 90,
    p95LatencyMs: 90,
    byGrader: [
      { grader: 'exactMatch', total: 1, passed: 0, failed: 1, passRate: 0, meanScore: 0 },
    ],
  },
  thresholdResult: {
    pass: false,
    failures: [
      {
        kind: 'overall-pass-rate',
        expected: 1,
        actual: 0,
        message: 'Overall pass rate 0.0% is below the required 100.0%.',
      },
    ],
  },
};

describe('formatReport', () => {
  it('includes the suite name and version', () => {
    const report = formatReport(passingResult);
    expect(report).toContain('greeting-suite');
    expect(report).toContain('v1.0.0');
  });

  it('omits the version segment when the suite has none', () => {
    const report = formatReport(failingResult);
    expect(report).not.toContain('@');
  });

  it('reports each case by name (falling back to id) with a pass/fail marker', () => {
    const report = formatReport(passingResult);
    expect(report).toContain('says hello');

    const failReport = formatReport(failingResult);
    expect(failReport).toContain('b'); // no `name`, falls back to id
  });

  it('shows the failure reason for a failed grader', () => {
    const report = formatReport(failingResult);
    expect(report).toContain('Expected "hi", got "bonjour".');
  });

  it('shows the adapter error message for a case that errored', () => {
    const report = formatReport(failingResult);
    expect(report).toContain('adapter timed out');
  });

  it('reports per-grader pass rate and mean score', () => {
    const report = formatReport(passingResult);
    expect(report).toContain('exactMatch: 1/1');
    expect(report).toContain('mean score 1.000');
  });

  it('reports total cost when present, and omits it when absent', () => {
    expect(formatReport(passingResult)).toContain('total cost:');
    expect(formatReport(failingResult)).not.toContain('total cost:');
  });

  it('reports threshold failures with their messages', () => {
    const report = formatReport(failingResult);
    expect(report).toContain('Thresholds failed');
    expect(report).toContain('Overall pass rate 0.0% is below the required 100.0%.');
  });

  it('reports success when thresholds pass', () => {
    expect(formatReport(passingResult)).toContain('Thresholds passed');
  });
});
