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
        'packages/promptproof/src/cli/**',
        // Type-only modules (interfaces, no runtime code) — nothing to cover.
        'packages/promptproof/src/core/types.ts',
        'packages/promptproof/src/core/results.ts',
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
