import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PromptProofConfig } from '../config.js';
import { PromptProofError } from '../core/errors.js';

const CANDIDATE_FILENAMES = [
  'promptproof.config.ts',
  'promptproof.config.mts',
  'promptproof.config.js',
  'promptproof.config.mjs',
  'promptproof.config.cjs',
];

function resolveConfigPath(explicitPath: string | undefined, cwd: string): string {
  if (explicitPath) {
    const resolved = resolve(cwd, explicitPath);
    if (!existsSync(resolved)) {
      throw new PromptProofError(`Config file not found: ${resolved}`);
    }
    return resolved;
  }

  for (const candidate of CANDIDATE_FILENAMES) {
    const candidatePath = resolve(cwd, candidate);
    if (existsSync(candidatePath)) return candidatePath;
  }

  throw new PromptProofError(
    `No config file found in ${cwd}. Expected one of: ${CANDIDATE_FILENAMES.join(', ')} ` +
      '(or pass --config <path>).',
  );
}

async function importModule(path: string): Promise<unknown> {
  if (/\.(ts|mts|cts)$/.test(path)) {
    // TypeScript config files are loaded on the fly via jiti so consumers
    // never need to pre-compile promptproof.config.ts themselves.
    const { createJiti } = await import('jiti');
    const jiti = createJiti(import.meta.url);
    return jiti.import(path);
  }
  return import(pathToFileURL(path).href);
}

function isPromptProofConfig(value: unknown): value is PromptProofConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'suite' in value &&
    'adapter' in value &&
    typeof (value as { adapter: unknown }).adapter === 'function'
  );
}

/**
 * Resolves and loads `promptproof.config.{ts,mts,js,mjs,cjs}` (or an
 * explicit `--config` path) from `cwd`, validating that it default-exports a
 * {@link PromptProofConfig}.
 */
export async function loadConfig(
  explicitPath: string | undefined,
  cwd: string = process.cwd(),
): Promise<PromptProofConfig> {
  const path = resolveConfigPath(explicitPath, cwd);
  const loadedModule = await importModule(path);
  const exported =
    typeof loadedModule === 'object' && loadedModule !== null && 'default' in loadedModule
      ? loadedModule.default
      : loadedModule;

  if (!isPromptProofConfig(exported)) {
    throw new PromptProofError(
      `${path} must default-export a PromptProofConfig (use defineConfig({ suite, adapter })).`,
    );
  }

  return exported;
}
