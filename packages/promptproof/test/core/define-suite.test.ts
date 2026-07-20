import { describe, expect, it } from 'vitest';
import { defineSuite } from '../../src/core/define-suite.js';
import { PromptProofError } from '../../src/core/errors.js';
import type { Grader } from '../../src/core/types.js';

const passGrader: Grader = { name: 'always-pass', grade: () => ({ pass: true }) };
const otherGrader: Grader = { name: 'other', grade: () => ({ pass: true }) };

describe('defineSuite', () => {
  it('returns a frozen suite when the definition is valid', () => {
    const suite = defineSuite({
      name: 'my-suite',
      cases: [{ id: 'case-1', input: 'hello' }],
      graders: [passGrader],
    });

    expect(suite.name).toBe('my-suite');
    expect(Object.isFrozen(suite)).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(() =>
      defineSuite({ name: '  ', cases: [{ id: 'a', input: 1 }], graders: [passGrader] }),
    ).toThrow(PromptProofError);
  });

  it('rejects a suite with no cases', () => {
    expect(() => defineSuite({ name: 's', cases: [], graders: [passGrader] })).toThrow(
      /at least one case/,
    );
  });

  it('rejects a suite with no graders', () => {
    expect(() =>
      defineSuite({ name: 's', cases: [{ id: 'a', input: 1 }], graders: [] }),
    ).toThrow(/at least one grader/);
  });

  it('rejects duplicate case ids', () => {
    expect(() =>
      defineSuite({
        name: 's',
        cases: [
          { id: 'dup', input: 1 },
          { id: 'dup', input: 2 },
        ],
        graders: [passGrader],
      }),
    ).toThrow(/duplicate case id "dup"/);
  });

  it('rejects a case with an empty id', () => {
    expect(() =>
      defineSuite({ name: 's', cases: [{ id: '  ', input: 1 }], graders: [passGrader] }),
    ).toThrow(/case with an empty id/);
  });

  it('rejects a grader with an empty name', () => {
    expect(() =>
      defineSuite({
        name: 's',
        cases: [{ id: 'a', input: 1 }],
        graders: [{ name: '  ', grade: () => ({ pass: true }) }],
      }),
    ).toThrow(/grader with an empty name/);
  });

  it('rejects duplicate grader names', () => {
    expect(() =>
      defineSuite({
        name: 's',
        cases: [{ id: 'a', input: 1 }],
        graders: [passGrader, { name: 'always-pass', grade: () => ({ pass: true }) }],
      }),
    ).toThrow(/duplicate grader name "always-pass"/);
  });

  it('rejects thresholds that reference an unknown grader', () => {
    expect(() =>
      defineSuite({
        name: 's',
        cases: [{ id: 'a', input: 1 }],
        graders: [passGrader],
        thresholds: { graders: { nonexistent: { minPassRate: 1 } } },
      }),
    ).toThrow(/unknown grader "nonexistent"/);
  });

  it('accepts thresholds that reference a known grader', () => {
    const suite = defineSuite({
      name: 's',
      cases: [{ id: 'a', input: 1 }],
      graders: [passGrader, otherGrader],
      thresholds: { graders: { other: { minPassRate: 0.5 } } },
    });
    expect(suite.thresholds?.graders?.['other']?.minPassRate).toBe(0.5);
  });
});
