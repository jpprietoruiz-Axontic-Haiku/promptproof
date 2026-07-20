import { describe, expect, it } from 'vitest';
import { exactMatch } from '../../src/graders/exact-match.js';
import type { GraderContext, SuiteCase } from '../../src/core/types.js';

function ctx(output: string, expected?: string): GraderContext<unknown, string> {
  const suiteCase: SuiteCase<unknown, string> = {
    id: 'c1',
    input: 'irrelevant',
    ...(expected !== undefined ? { expected } : {}),
  };
  return { case: suiteCase, output, latencyMs: 1 };
}

describe('exactMatch', () => {
  it('has the default name', () => {
    expect(exactMatch().name).toBe('exactMatch');
  });

  it('accepts a custom name', () => {
    expect(exactMatch({ name: 'my-check' }).name).toBe('my-check');
  });

  it('passes on an exact match', async () => {
    const result = await exactMatch().grade(ctx('hello', 'hello'));
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails on a mismatch, with a helpful reason', async () => {
    const result = await exactMatch().grade(ctx('hello', 'goodbye'));
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain('goodbye');
  });

  it('fails when the case has no expected value', async () => {
    const result = await exactMatch().grade(ctx('hello'));
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('no `expected` value');
  });

  it('trims whitespace by default', async () => {
    const result = await exactMatch().grade(ctx('  hello  ', 'hello'));
    expect(result.pass).toBe(true);
  });

  it('respects trim: false', async () => {
    const result = await exactMatch({ trim: false }).grade(ctx('  hello  ', 'hello'));
    expect(result.pass).toBe(false);
  });

  it('is case-sensitive by default', async () => {
    const result = await exactMatch().grade(ctx('Hello', 'hello'));
    expect(result.pass).toBe(false);
  });

  it('ignores case when caseSensitive: false', async () => {
    const result = await exactMatch({ caseSensitive: false }).grade(
      ctx('Hello', 'hello'),
    );
    expect(result.pass).toBe(true);
  });
});
