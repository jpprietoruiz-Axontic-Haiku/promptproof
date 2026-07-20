import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/cli/config-loader.js';
import { PromptProofError } from '../../src/core/errors.js';

const VALID_CONFIG = `
export default {
  suite: {
    name: 's',
    cases: [{ id: 'a', input: 1 }],
    graders: [{ name: 'g', grade: () => ({ pass: true }) }],
  },
  adapter: () => ({ output: 'x' }),
};
`;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'promptproof-config-'));
  // Without this, a bare `.js` config file would be parsed as CommonJS and
  // reject the `export default` syntax used by VALID_CONFIG.
  await writeFile(join(dir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('loads the default promptproof.config.mjs from cwd when no path is given', async () => {
    await writeFile(join(dir, 'promptproof.config.mjs'), VALID_CONFIG, 'utf8');

    const config = await loadConfig(undefined, dir);

    expect(config.suite.name).toBe('s');
    expect(typeof config.adapter).toBe('function');
  });

  it('loads an explicit --config path', async () => {
    await writeFile(join(dir, 'custom.config.mjs'), VALID_CONFIG, 'utf8');

    const config = await loadConfig('custom.config.mjs', dir);
    expect(config.suite.name).toBe('s');
  });

  it('throws a PromptProofError when no config file exists', async () => {
    await expect(loadConfig(undefined, dir)).rejects.toThrow(PromptProofError);
    await expect(loadConfig(undefined, dir)).rejects.toThrow(/No config file found/);
  });

  it('throws a PromptProofError when an explicit --config path does not exist', async () => {
    await expect(loadConfig('missing.config.mjs', dir)).rejects.toThrow(
      /Config file not found/,
    );
  });

  it('throws a PromptProofError when the module has no default export shaped like a config', async () => {
    await writeFile(
      join(dir, 'promptproof.config.mjs'),
      'export default { foo: 1 };',
      'utf8',
    );
    await expect(loadConfig(undefined, dir)).rejects.toThrow(
      /must default-export a PromptProofConfig/,
    );
  });

  it('throws a PromptProofError when `adapter` is not a function', async () => {
    await writeFile(
      join(dir, 'promptproof.config.mjs'),
      "export default { suite: {}, adapter: 'not-a-function' };",
      'utf8',
    );
    await expect(loadConfig(undefined, dir)).rejects.toThrow(PromptProofError);
  });

  it('prefers promptproof.config.js over .mjs when both are present', async () => {
    await writeFile(
      join(dir, 'promptproof.config.js'),
      VALID_CONFIG.replace("'s'", "'from-js'"),
      'utf8',
    );
    await writeFile(
      join(dir, 'promptproof.config.mjs'),
      VALID_CONFIG.replace("'s'", "'from-mjs'"),
      'utf8',
    );

    const config = await loadConfig(undefined, dir);
    expect(config.suite.name).toBe('from-js');
  });
});
