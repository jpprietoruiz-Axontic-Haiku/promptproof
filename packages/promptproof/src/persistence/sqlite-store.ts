import DatabaseConstructor, { type Database } from 'better-sqlite3';
import type { SuiteRunResult } from '../core/results.js';
import type { RunRecord, RunStore } from './types.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_name TEXT NOT NULL,
    suite_version TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    total INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    failed INTEGER NOT NULL,
    pass_rate REAL NOT NULL,
    mean_latency_ms REAL NOT NULL,
    p95_latency_ms REAL NOT NULL,
    total_cost_usd REAL,
    threshold_pass INTEGER NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_runs_suite_name ON runs (suite_name, id);
`;

interface RunRow {
  id: number;
  suite_name: string;
  suite_version: string | null;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
  mean_latency_ms: number;
  p95_latency_ms: number;
  total_cost_usd: number | null;
  threshold_pass: number;
  result_json: string;
  created_at: string;
}

function rowToRecord(row: RunRow): RunRecord {
  return {
    id: row.id,
    suiteName: row.suite_name,
    suiteVersion: row.suite_version,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    total: row.total,
    passed: row.passed,
    failed: row.failed,
    passRate: row.pass_rate,
    meanLatencyMs: row.mean_latency_ms,
    p95LatencyMs: row.p95_latency_ms,
    totalCostUsd: row.total_cost_usd,
    thresholdPass: row.threshold_pass === 1,
    result: JSON.parse(row.result_json) as SuiteRunResult,
    createdAt: row.created_at,
  };
}

/**
 * SQLite-backed {@link RunStore}. Pass `':memory:'` for an ephemeral,
 * disk-free store (used in tests).
 */
export class SqliteRunStore implements RunStore {
  readonly #db: Database;

  constructor(path: string) {
    this.#db = new DatabaseConstructor(path);
    this.#db.pragma('journal_mode = WAL');
    this.#db.exec(SCHEMA);
  }

  saveRun(result: SuiteRunResult): RunRecord {
    const createdAt = new Date().toISOString();

    const insert = this.#db.prepare<{
      suiteName: string;
      suiteVersion: string | null;
      startedAt: string;
      finishedAt: string;
      durationMs: number;
      total: number;
      passed: number;
      failed: number;
      passRate: number;
      meanLatencyMs: number;
      p95LatencyMs: number;
      totalCostUsd: number | null;
      thresholdPass: number;
      resultJson: string;
      createdAt: string;
    }>(`
      INSERT INTO runs (
        suite_name, suite_version, started_at, finished_at, duration_ms,
        total, passed, failed, pass_rate, mean_latency_ms, p95_latency_ms,
        total_cost_usd, threshold_pass, result_json, created_at
      ) VALUES (
        @suiteName, @suiteVersion, @startedAt, @finishedAt, @durationMs,
        @total, @passed, @failed, @passRate, @meanLatencyMs, @p95LatencyMs,
        @totalCostUsd, @thresholdPass, @resultJson, @createdAt
      )
    `);

    const info = insert.run({
      suiteName: result.suiteName,
      suiteVersion: result.suiteVersion ?? null,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      durationMs: result.durationMs,
      total: result.aggregates.total,
      passed: result.aggregates.passed,
      failed: result.aggregates.failed,
      passRate: result.aggregates.passRate,
      meanLatencyMs: result.aggregates.meanLatencyMs,
      p95LatencyMs: result.aggregates.p95LatencyMs,
      totalCostUsd: result.aggregates.totalCostUsd ?? null,
      thresholdPass: result.thresholdResult.pass ? 1 : 0,
      resultJson: JSON.stringify(result),
      createdAt,
    });

    return {
      id: Number(info.lastInsertRowid),
      suiteName: result.suiteName,
      suiteVersion: result.suiteVersion ?? null,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      durationMs: result.durationMs,
      total: result.aggregates.total,
      passed: result.aggregates.passed,
      failed: result.aggregates.failed,
      passRate: result.aggregates.passRate,
      meanLatencyMs: result.aggregates.meanLatencyMs,
      p95LatencyMs: result.aggregates.p95LatencyMs,
      totalCostUsd: result.aggregates.totalCostUsd ?? null,
      thresholdPass: result.thresholdResult.pass,
      result,
      createdAt,
    };
  }

  listRuns(suiteName: string, limit = 50): RunRecord[] {
    const rows = this.#db
      .prepare<{ suiteName: string; limit: number }, RunRow>(
        'SELECT * FROM runs WHERE suite_name = @suiteName ORDER BY id DESC LIMIT @limit',
      )
      .all({ suiteName, limit });
    return rows.map(rowToRecord);
  }

  getLatestRun(suiteName: string): RunRecord | undefined {
    const row = this.#db
      .prepare<{ suiteName: string }, RunRow>(
        'SELECT * FROM runs WHERE suite_name = @suiteName ORDER BY id DESC LIMIT 1',
      )
      .get({ suiteName });
    return row ? rowToRecord(row) : undefined;
  }

  close(): void {
    this.#db.close();
  }
}
