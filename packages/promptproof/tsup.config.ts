import { chmodSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    name: 'lib',
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'node18',
    outDir: 'dist',
  },
  {
    // Separate entry point so browser-safe code (e.g. the dashboard) can
    // depend on the main package without pulling in better-sqlite3, a
    // Node-only native module.
    name: 'persistence',
    entry: { persistence: 'src/persistence/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    target: 'node18',
    outDir: 'dist',
  },
  {
    name: 'cli',
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: false,
    target: 'node18',
    outDir: 'dist',
    banner: { js: '#!/usr/bin/env node' },
    // `npm ci` links node_modules/.bin/promptproof before this build ever
    // runs, so it can't chmod a file that doesn't exist yet — do it
    // ourselves, or `npx promptproof` fails on POSIX CI runners with
    // "not found" even though the symlink and the file are both there.
    onSuccess: async () => {
      chmodSync('dist/cli/index.js', 0o755);
    },
  },
]);
