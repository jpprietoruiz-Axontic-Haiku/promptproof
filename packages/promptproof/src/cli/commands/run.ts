import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { compareRuns } from '../../core/compare.js';
import type { RegressionReport } from '../../core/compare.js';
import { PromptProofError } from '../../core/errors.js';
import type { SuiteRunResult } from '../../core/results.js';
import { run as runSuite } from '../../core/run.js';
import { SqliteRunStore } from '../../persistence/sqlite-store.js';
import { loadConfig } from '../config-loader.js';
import { formatReport } from '../report.js';

export interface RunCommandOptions {
  readonly cwd?: string;
  readonly print?: (message: string) => void;
}

function parseConcurrency(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new PromptProofError(`--concurrency must be a positive integer, got "${raw}".`);
  }
  return parsed;
}

/**
 * Implements `promptproof run`: loads the config, executes the suite, prints
 * a console report, optionally compares against a baseline run and exports
 * JSON, and persists the run to SQLite.
 *
 * @returns The process exit code — `0` only when the suite's own thresholds
 * pass *and* (if a baseline was given) no configured metric regressed.
 */
export async function runCommand(
  argv: string[],
  options: RunCommandOptions = {},
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const print =
    options.print ?? ((message: string) => process.stdout.write(`${message}\n`));

  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      json: { type: 'string' },
      db: { type: 'string' },
      baseline: { type: 'string' },
      concurrency: { type: 'string' },
      'no-save': { type: 'boolean', default: false },
    },
    strict: true,
  });

  const config = await loadConfig(values.config, cwd);
  const concurrency = parseConcurrency(values.concurrency) ?? config.concurrency;

  const result = await runSuite(config.suite, {
    adapter: config.adapter,
    ...(concurrency !== undefined ? { concurrency } : {}),
  });

  let regressed = false;
  let regressionReport: RegressionReport | undefined;
  if (values.baseline) {
    const baselinePath = resolve(cwd, values.baseline);
    if (existsSync(baselinePath)) {
      const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as SuiteRunResult;
      regressionReport = compareRuns(baseline, result, config.regression);
      regressed = regressionReport.regressed;
    } else {
      print(`No baseline found at ${baselinePath} — skipping regression check.\n`);
    }
  }

  print(formatReport(result, regressionReport));

  if (values.json) {
    const jsonPath = resolve(cwd, values.json);
    await writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf8');
    print(`\nJSON report written to ${jsonPath}`);
  }

  if (!values['no-save']) {
    const dbPath = resolve(
      cwd,
      values.db ?? process.env['PROMPTPROOF_DB_PATH'] ?? './promptproof.db',
    );
    const store = new SqliteRunStore(dbPath);
    try {
      store.saveRun(result);
      print(`\nRun saved to ${dbPath}`);
    } finally {
      store.close();
    }
  }

  return result.thresholdResult.pass && !regressed ? 0 : 1;
}
