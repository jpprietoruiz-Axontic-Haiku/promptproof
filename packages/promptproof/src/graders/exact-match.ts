import type { Grader } from '../core/types.js';

export interface ExactMatchOptions {
  /** Defaults to `true`. */
  readonly caseSensitive?: boolean;
  /** Trim both sides before comparing. Defaults to `true`. */
  readonly trim?: boolean;
  /** Grader name, used in reports and threshold config. Defaults to `'exactMatch'`. */
  readonly name?: string;
}

/**
 * Passes when the output equals `case.expected` exactly (after optional
 * trimming/case-folding).
 *
 * @example
 * ```ts
 * defineSuite({
 *   cases: [{ id: 'greet', input: 'Say hi', expected: 'hi' }],
 *   graders: [exactMatch({ caseSensitive: false })],
 * });
 * ```
 */
export function exactMatch(options: ExactMatchOptions = {}): Grader<unknown, string> {
  const name = options.name ?? 'exactMatch';
  const caseSensitive = options.caseSensitive ?? true;
  const trim = options.trim ?? true;

  const normalize = (value: string): string => {
    const trimmed = trim ? value.trim() : value;
    return caseSensitive ? trimmed : trimmed.toLowerCase();
  };

  return {
    name,
    grade({ case: suiteCase, output }) {
      if (suiteCase.expected === undefined) {
        return {
          pass: false,
          reason: `Case "${suiteCase.id}" has no \`expected\` value to compare against.`,
        };
      }

      const actual = normalize(output);
      const expected = normalize(suiteCase.expected);
      const pass = actual === expected;

      return {
        pass,
        score: pass ? 1 : 0,
        ...(pass ? {} : { reason: `Expected "${expected}", got "${actual}".` }),
      };
    },
  };
}
