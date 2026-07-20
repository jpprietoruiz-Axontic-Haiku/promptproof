import { VERSION } from '../index.js';

const args = process.argv.slice(2);

if (args[0] === '--version' || args[0] === '-v') {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

process.stdout.write(
  [
    `promptproof v${VERSION}`,
    '',
    'Usage:',
    '  promptproof run       Run an evaluation suite (coming in a later milestone)',
    '  promptproof --version  Print the CLI version',
    '',
  ].join('\n'),
);
