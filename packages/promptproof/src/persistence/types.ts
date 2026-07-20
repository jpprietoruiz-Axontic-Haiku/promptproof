import type { SuiteRunResult } from '../core/results.js';

/** A persisted run, as read back from the store. */
export interface RunRecord {
  readonly id: number;
  readonly suiteName: string;
  readonly suiteVersion: string | null;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly passRate: number;
  readonly meanLatencyMs: number;
  readonly p95LatencyMs: number;
  readonly totalCostUsd: number | null;
  readonly thresholdPass: boolean;
  /** The full result this record summarizes, exactly as {@link run} produced it. */
  readonly result: SuiteRunResult;
  readonly createdAt: string;
}

/** Storage backend for suite runs. Implemented by {@link SqliteRunStore}. */
export interface RunStore {
  saveRun(result: SuiteRunResult): RunRecord;
  listRuns(suiteName: string, limit?: number): RunRecord[];
  getLatestRun(suiteName: string): RunRecord | undefined;
  close(): void;
}
