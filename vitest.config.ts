import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/*/{src,test}/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'packages/dashboard/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/promptproof/src/**/*.ts'],
      exclude: [
        'packages/promptproof/src/**/*.d.ts',
        // Thin process-level wiring (argv parsing, dispatch, top-level
        // catch) — covered by manual/E2E verification, not unit tests.
        'packages/promptproof/src/cli/index.ts',
        // Type-only modules (interfaces, no runtime code) — nothing to cover.
        'packages/promptproof/src/core/types.ts',
        'packages/promptproof/src/core/results.ts',
        'packages/promptproof/src/persistence/types.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
