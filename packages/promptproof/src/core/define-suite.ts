import { PromptProofError } from './errors.js';
import type { Grader, Suite, SuiteDefinition } from './types.js';

/**
 * Validates and freezes a suite definition.
 *
 * Validation is intentionally synchronous and cheap (no adapter/grader calls)
 * so config errors — duplicate ids, unknown threshold references — surface
 * immediately, before any LLM call is made.
 *
 * @example
 * ```ts
 * const suite = defineSuite({
 *   name: 'support-bot-summaries',
 *   cases: [
 *     { id: 'refund-request', input: 'I want a refund', expected: 'refund' },
 *   ],
 *   graders: [exactMatch()],
 *   thresholds: { passRate: 0.95 },
 * });
 * ```
 */
export function defineSuite<TInput = unknown, TExpected = unknown>(
  definition: Omit<SuiteDefinition<TInput, TExpected>, 'graders'> & {
    // TInput/TExpected are inferred from `cases` alone; NoInfer keeps a
    // generic-agnostic grader (the common case for built-in graders) from
    // widening that inference back to `unknown`.
    readonly graders: ReadonlyArray<Grader<NoInfer<TInput>, NoInfer<TExpected>>>;
  },
): Suite<TInput, TExpected> {
  if (!definition.name.trim()) {
    throw new PromptProofError('defineSuite() requires a non-empty `name`.');
  }

  if (definition.cases.length === 0) {
    throw new PromptProofError(
      `Suite "${definition.name}" must define at least one case.`,
    );
  }

  if (definition.graders.length === 0) {
    throw new PromptProofError(
      `Suite "${definition.name}" must define at least one grader.`,
    );
  }

  const seenCaseIds = new Set<string>();
  for (const suiteCase of definition.cases) {
    if (!suiteCase.id.trim()) {
      throw new PromptProofError(
        `Suite "${definition.name}" has a case with an empty id.`,
      );
    }
    if (seenCaseIds.has(suiteCase.id)) {
      throw new PromptProofError(
        `Suite "${definition.name}" has duplicate case id "${suiteCase.id}". Case ids must be unique within a suite.`,
      );
    }
    seenCaseIds.add(suiteCase.id);
  }

  const seenGraderNames = new Set<string>();
  for (const grader of definition.graders) {
    if (!grader.name.trim()) {
      throw new PromptProofError(
        `Suite "${definition.name}" has a grader with an empty name.`,
      );
    }
    if (seenGraderNames.has(grader.name)) {
      throw new PromptProofError(
        `Suite "${definition.name}" has duplicate grader name "${grader.name}". Grader names must be unique within a suite.`,
      );
    }
    seenGraderNames.add(grader.name);
  }

  for (const graderName of Object.keys(definition.thresholds?.graders ?? {})) {
    if (!seenGraderNames.has(graderName)) {
      throw new PromptProofError(
        `Suite "${definition.name}" has a threshold for unknown grader "${graderName}". ` +
          `Known graders: ${[...seenGraderNames].join(', ') || '(none)'}.`,
      );
    }
  }

  return Object.freeze({ ...definition });
}
