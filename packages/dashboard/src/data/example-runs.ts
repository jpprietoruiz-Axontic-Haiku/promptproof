import type { SuiteHistory } from './types';

/**
 * Bundled example data for the demo deployment — this dashboard reads no
 * live backend. In a real deployment, replace this with a fetch against
 * your persisted run history (SQLite locally, Postgres when hosted; see
 * `promptproof/persistence`).
 */
export const EXAMPLE_HISTORY: readonly [SuiteHistory, ...SuiteHistory[]] = [
  {
    suiteName: 'clauselens-risk-classifier',
    description:
      'Evaluates a contract-clause risk classifier (see examples/clauselens-suite) — a real, LLM-backed suite with the noisy, evolving quality curve typical of prompt iteration.',
    runs: [
      {
        version: 'v0.1.0',
        date: '2025-01-15',
        passRate: 0.72,
        meanLatencyMs: 1450,
        p95LatencyMs: 2100,
        totalCostUsd: 0.018,
        byGrader: [
          { grader: 'jsonSchema', passRate: 0.9 },
          { grader: 'faithfulness', passRate: 0.65, meanScore: 0.65 },
        ],
      },
      {
        version: 'v0.2.0',
        date: '2025-02-12',
        passRate: 0.78,
        meanLatencyMs: 1400,
        p95LatencyMs: 2050,
        totalCostUsd: 0.017,
        byGrader: [
          { grader: 'jsonSchema', passRate: 0.93 },
          { grader: 'faithfulness', passRate: 0.71, meanScore: 0.71 },
        ],
      },
      {
        version: 'v0.3.0',
        date: '2025-03-10',
        passRate: 0.85,
        meanLatencyMs: 1280,
        p95LatencyMs: 1900,
        totalCostUsd: 0.015,
        byGrader: [
          { grader: 'jsonSchema', passRate: 0.96 },
          { grader: 'faithfulness', passRate: 0.79, meanScore: 0.79 },
        ],
      },
      {
        version: 'v0.4.0',
        date: '2025-04-08',
        passRate: 0.89,
        meanLatencyMs: 1150,
        p95LatencyMs: 1700,
        totalCostUsd: 0.013,
        byGrader: [
          { grader: 'jsonSchema', passRate: 0.98 },
          { grader: 'faithfulness', passRate: 0.84, meanScore: 0.84 },
        ],
      },
      {
        version: 'v0.5.0',
        date: '2025-05-06',
        passRate: 0.81,
        meanLatencyMs: 1600,
        p95LatencyMs: 2400,
        totalCostUsd: 0.021,
        byGrader: [
          { grader: 'jsonSchema', passRate: 0.95 },
          { grader: 'faithfulness', passRate: 0.74, meanScore: 0.74 },
        ],
      },
      {
        version: 'v0.6.0',
        date: '2025-06-03',
        passRate: 0.9,
        meanLatencyMs: 1100,
        p95LatencyMs: 1650,
        totalCostUsd: 0.012,
        byGrader: [
          { grader: 'jsonSchema', passRate: 0.99 },
          { grader: 'faithfulness', passRate: 0.86, meanScore: 0.86 },
        ],
      },
      {
        version: 'v0.7.0',
        date: '2025-07-01',
        passRate: 0.93,
        meanLatencyMs: 980,
        p95LatencyMs: 1500,
        totalCostUsd: 0.01,
        byGrader: [
          { grader: 'jsonSchema', passRate: 1 },
          { grader: 'faithfulness', passRate: 0.9, meanScore: 0.9 },
        ],
      },
      {
        version: 'v0.8.0',
        date: '2025-07-29',
        passRate: 0.95,
        meanLatencyMs: 920,
        p95LatencyMs: 1400,
        totalCostUsd: 0.009,
        byGrader: [
          { grader: 'jsonSchema', passRate: 1 },
          { grader: 'faithfulness', passRate: 0.93, meanScore: 0.93 },
        ],
      },
    ],
  },
  {
    suiteName: 'selfcheck-intent-classifier',
    description:
      'Deterministic, zero-API-key suite (see examples/selfcheck-suite) that dogfoods the CI gate on every PR in this repo — flat by design, since the system under test has no model in the loop.',
    runs: [
      {
        version: 'v0.1.0',
        date: '2025-07-01',
        passRate: 1,
        meanLatencyMs: 1,
        p95LatencyMs: 1,
        byGrader: [
          { grader: 'jsonSchema', passRate: 1 },
          { grader: 'latencyUnder', passRate: 1 },
        ],
      },
      {
        version: 'v0.2.0',
        date: '2025-07-08',
        passRate: 1,
        meanLatencyMs: 1,
        p95LatencyMs: 2,
        byGrader: [
          { grader: 'jsonSchema', passRate: 1 },
          { grader: 'latencyUnder', passRate: 1 },
        ],
      },
      {
        version: 'v0.3.0',
        date: '2025-07-15',
        passRate: 1,
        meanLatencyMs: 1,
        p95LatencyMs: 1,
        byGrader: [
          { grader: 'jsonSchema', passRate: 1 },
          { grader: 'latencyUnder', passRate: 1 },
        ],
      },
    ],
  },
];
