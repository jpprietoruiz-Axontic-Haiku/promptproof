/** Per-grader summary for a single run, as shown on the dashboard. */
export interface GraderSummary {
  readonly grader: string;
  readonly passRate: number;
  readonly meanScore?: number;
}

/** One run's aggregates, condensed for charting — the dashboard equivalent of `SuiteAggregates`. */
export interface RunSummary {
  readonly version: string;
  readonly date: string;
  readonly passRate: number;
  readonly meanLatencyMs: number;
  readonly p95LatencyMs: number;
  readonly totalCostUsd?: number;
  readonly byGrader: readonly GraderSummary[];
}

/** A suite's full run history, oldest first. */
export interface SuiteHistory {
  readonly suiteName: string;
  readonly description: string;
  readonly runs: readonly RunSummary[];
}
