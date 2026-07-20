import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { run as runSuite } from '../../core/run.js';
import { PromptProofError } from '../../core/errors.js';
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
 * a console report, optionally exports JSON, and persists the run to SQLite.
 *
 * @returns The process exit code (`0` when thresholds pass, `1` otherwise).
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

  print(formatReport(result));

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

  return result.thresholdResult.pass ? 0 : 1;
}
