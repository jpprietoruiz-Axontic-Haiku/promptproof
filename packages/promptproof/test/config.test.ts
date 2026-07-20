import { describe, expect, it } from 'vitest';
import { defineConfig } from '../src/config.js';
import { defineSuite } from '../src/core/define-suite.js';
import { exactMatch } from '../src/graders/exact-match.js';

describe('defineConfig', () => {
  it('returns the config object unchanged (identity helper for type inference)', () => {
    const suite = defineSuite({
      name: 's',
      cases: [{ id: 'a', input: 'x', expected: 'x' }],
      graders: [exactMatch()],
    });
    const adapter = (input: string) => ({ output: input });

    const config = defineConfig({ suite, adapter });

    expect(config.suite).toBe(suite);
    expect(config.adapter).toBe(adapter);
  });
});
