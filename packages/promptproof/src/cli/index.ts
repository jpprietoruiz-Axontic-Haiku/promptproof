import { PromptProofError } from '../core/errors.js';
import { VERSION } from '../index.js';
import { runCommand } from './commands/run.js';

function printUsage(): void {
  process.stdout.write(
    [
      `promptproof v${VERSION}`,
      '',
      'Usage:',
      '  promptproof run [options]    Run the evaluation suite from promptproof.config.ts',
      '  promptproof --version        Print the CLI version',
      '  promptproof --help           Show this help message',
      '',
      'Options for `run`:',
      '  --config <path>     Config file path (default: promptproof.config.{ts,mts,js,mjs,cjs})',
      '  --json <path>       Write the full run result as JSON to <path>',
      '  --db <path>         SQLite database path (default: $PROMPTPROOF_DB_PATH or ./promptproof.db)',
      '  --no-save           Skip saving the run to SQLite',
      '  --concurrency <n>   Override the max concurrent adapter calls',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === '--version' || command === '-v') {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (command === 'run') {
    process.exitCode = await runCommand(rest);
    return;
  }

  process.stderr.write(`Unknown command "${command}".\n\n`);
  printUsage();
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  if (error instanceof PromptProofError) {
    process.stderr.write(`Error: ${error.message}\n`);
  } else {
    process.stderr.write(
      `Unexpected error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
  }
  process.exitCode = 1;
});
