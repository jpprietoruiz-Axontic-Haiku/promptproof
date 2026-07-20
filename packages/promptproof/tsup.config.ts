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
    name: 'cli',
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: false,
    target: 'node18',
    outDir: 'dist',
    banner: { js: '#!/usr/bin/env node' },
  },
]);
