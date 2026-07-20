import type { CostInfo, GraderResult, SuiteCase } from './types.js';

/** JSON-serializable snapshot of a thrown error. */
export interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
}

/** A grader's verdict for one case, tagged with which grader produced it. */
export interface GraderOutcome extends GraderResult {
  readonly grader: string;
}

/** Outcome of running a single {@link SuiteCase}. */
export interface CaseResult<TInput = unknown, TExpected = unknown> {
  readonly case: SuiteCase<TInput, TExpected>;
  /** Absent when the adapter threw — see {@link CaseResult.error}. */
  readonly output?: string;
  readonly latencyMs?: number;
  readonly cost?: CostInfo;
  /** Empty when the adapter threw before any grader could run. */
  readonly graderResults: readonly GraderOutcome[];
  /** `true` only when the adapter succeeded and every grader passed. */
  readonly pass: boolean;
  /** Set when the adapter call itself threw. */
  readonly error?: SerializedError;
}

/** Per-grader statistics aggregated across a suite run. */
export interface GraderAggregate {
  readonly grader: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly passRate: number;
  /** Mean of reported `score` values; absent if no grader outcome reported one. */
  readonly meanScore?: number;
}

/** Suite-wide statistics for a run. */
export interface SuiteAggregates {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly passRate: number;
  readonly meanLatencyMs: number;
  readonly p95LatencyMs: number;
  /** Sum of `cost.totalCostUsd` across cases that reported one. */
  readonly totalCostUsd?: number;
  readonly byGrader: readonly GraderAggregate[];
}

/** One threshold that was not met, as configured in `suite.thresholds`. */
export interface ThresholdFailure {
  readonly kind: 'overall-pass-rate' | 'grader-pass-rate' | 'grader-mean-score';
  readonly grader?: string;
  readonly expected: number;
  readonly actual: number;
  readonly message: string;
}

/** Full, typed result of {@link run}. */
export interface SuiteRunResult<TInput = unknown, TExpected = unknown> {
  readonly suiteName: string;
  readonly suiteVersion?: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly cases: readonly CaseResult<TInput, TExpected>[];
  readonly aggregates: SuiteAggregates;
  /** Whether the run satisfies `suite.thresholds`, and why not if it doesn't. */
  readonly thresholdResult: {
    readonly pass: boolean;
    readonly failures: readonly ThresholdFailure[];
  };
}
