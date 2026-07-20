import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCommand } from '../../../src/cli/commands/run.js';
import type { SuiteRunResult } from '../../../src/core/results.js';
import { SqliteRunStore } from '../../../src/persistence/sqlite-store.js';

const PASSING_CONFIG = `
export default {
  suite: {
    name: 'greeting-suite',
    cases: [{ id: 'a', input: 'hi', expected: 'hi' }],
    graders: [{
      name: 'exactMatch',
      grade: ({ case: c, output }) => ({ pass: output === c.expected }),
    }],
  },
  adapter: (input) => ({ output: input }),
};
`;

const FAILING_CONFIG = PASSING_CONFIG.replace(
  "input: 'hi', expected: 'hi'",
  "input: 'hi', expected: 'bye'",
);

// Same failing suite, but with its own threshold relaxed to `passRate: 0` so
// the suite's own gate always passes — isolating the --baseline regression
// check from the suite's own threshold check in tests below.
const LENIENT_FAILING_CONFIG = FAILING_CONFIG.replace(
  'graders: [{',
  'thresholds: { passRate: 0 },\n    graders: [{',
);

function makeBaselineResult(passRate: number): SuiteRunResult {
  return {
    suiteName: 'greeting-suite',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    durationMs: 10,
    cases: [],
    aggregates: {
      total: 1,
      passed: passRate,
      failed: 1 - passRate,
      passRate,
      meanLatencyMs: 1,
      p95LatencyMs: 1,
      byGrader: [],
    },
    thresholdResult: { pass: true, failures: [] },
  };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'promptproof-run-'));
  await writeFile(join(dir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('runCommand', () => {
  it('prints a report and returns exit code 0 for a passing suite', async () => {
    await writeFile(join(dir, 'promptproof.config.mjs'), PASSING_CONFIG, 'utf8');
    const printed: string[] = [];

    const exitCode = await runCommand(['--no-save'], {
      cwd: dir,
      print: (m) => printed.push(m),
    });

    expect(exitCode).toBe(0);
    expect(printed.join('\n')).toContain('greeting-suite');
    expect(printed.join('\n')).toContain('Thresholds passed');
  });

  it('returns exit code 1 for a suite that fails its thresholds', async () => {
    await writeFile(join(dir, 'promptproof.config.mjs'), FAILING_CONFIG, 'utf8');

    const exitCode = await runCommand(['--no-save'], { cwd: dir, print: () => {} });

    expect(exitCode).toBe(1);
  });

  it('writes the full JSON result when --json is passed', async () => {
    await writeFile(join(dir, 'promptproof.config.mjs'), PASSING_CONFIG, 'utf8');

    await runCommand(['--no-save', '--json', 'out.json'], { cwd: dir, print: () => {} });

    const jsonPath = join(dir, 'out.json');
    expect(existsSync(jsonPath)).toBe(true);
    const parsed = JSON.parse(await readFile(jsonPath, 'utf8')) as SuiteRunResult;
    expect(parsed.suiteName).toBe('greeting-suite');
    expect(parsed.aggregates.passed).toBe(1);
  });

  it('does not create a database file when --no-save is passed', async () => {
    await writeFile(join(dir, 'promptproof.config.mjs'), PASSING_CONFIG, 'utf8');

    await runCommand(['--no-save'], { cwd: dir, print: () => {} });

    expect(existsSync(join(dir, 'promptproof.db'))).toBe(false);
  });

  it('saves the run to SQLite at --db by default', async () => {
    await writeFile(join(dir, 'promptproof.config.mjs'), PASSING_CONFIG, 'utf8');

    await runCommand(['--db', 'custom.db'], { cwd: dir, print: () => {} });

    const dbPath = join(dir, 'custom.db');
    expect(existsSync(dbPath)).toBe(true);

    const store = new SqliteRunStore(dbPath);
    try {
      const latest = store.getLatestRun('greeting-suite');
      expect(latest?.passed).toBe(1);
    } finally {
      store.close();
    }
  });

  it('skips the regression check and prints a notice when the baseline file is missing', async () => {
    await writeFile(join(dir, 'promptproof.config.mjs'), PASSING_CONFIG, 'utf8');
    const printed: string[] = [];

    const exitCode = await runCommand(['--no-save', '--baseline', 'baseline.json'], {
      cwd: dir,
      print: (m) => printed.push(m),
    });

    expect(exitCode).toBe(0);
    expect(printed.join('\n')).toContain('No baseline found');
  });

  it('passes the regression check when nothing regressed vs the baseline', async () => {
    await writeFile(join(dir, 'promptproof.config.mjs'), PASSING_CONFIG, 'utf8');
    await writeFile(
      join(dir, 'baseline.json'),
      JSON.stringify(makeBaselineResult(1)),
      'utf8',
    );
    const printed: string[] = [];

    const exitCode = await runCommand(['--no-save', '--baseline', 'baseline.json'], {
      cwd: dir,
      print: (m) => printed.push(m),
    });

    expect(exitCode).toBe(0);
    expect(printed.join('\n')).toContain('No regression vs baseline');
  });

  it("fails on a regression vs baseline even when the suite's own threshold passes", async () => {
    await writeFile(join(dir, 'promptproof.config.mjs'), LENIENT_FAILING_CONFIG, 'utf8');
    await writeFile(
      join(dir, 'baseline.json'),
      JSON.stringify(makeBaselineResult(1)),
      'utf8',
    );
    const printed: string[] = [];

    const exitCode = await runCommand(['--no-save', '--baseline', 'baseline.json'], {
      cwd: dir,
      print: (m) => printed.push(m),
    });

    expect(exitCode).toBe(1);
    expect(printed.join('\n')).toContain('Regression vs baseline');
    expect(printed.join('\n')).toContain('Pass rate dropped');
  });

  it('rejects a non-positive --concurrency', async () => {
    await writeFile(join(dir, 'promptproof.config.mjs'), PASSING_CONFIG, 'utf8');

    await expect(
      runCommand(['--no-save', '--concurrency', '0'], { cwd: dir, print: () => {} }),
    ).rejects.toThrow(/--concurrency must be a positive integer/);
  });
});
