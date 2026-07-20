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
      exclude: ['packages/promptproof/src/**/*.d.ts', 'packages/promptproof/src/cli/**'],
    },
  },
});
