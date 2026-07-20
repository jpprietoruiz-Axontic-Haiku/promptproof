import { PromptProofError } from '../core/errors.js';
import type { Adapter, Grader, GraderContext, SuiteCase } from '../core/types.js';

export interface LlmJudgeOptions {
  /** Rubric describing what a passing output looks like. */
  readonly criteria: string;
  /**
   * Adapter used to call the judge model — any {@link Adapter}, including
   * `openaiAdapter()`, `anthropicAdapter()`, or a custom function. This lets
   * you judge with a different (often cheaper or stronger) model than the
   * one under test.
   */
  readonly judge: Adapter<string>;
  /** Minimum judge score (`0`-`1`) required to pass. Defaults to `0.7`. */
  readonly threshold?: number;
  /** Grader name, used in reports and threshold config. Defaults to `'llmJudge'`. */
  readonly name?: string;
}

const RESPONSE_FORMAT_INSTRUCTIONS =
  'Respond with a single JSON object and nothing else, in the form ' +
  '{"score": <number between 0 and 1>, "reason": "<one sentence explanation>"}.';

function buildJudgePrompt(criteria: string, context: GraderContext): string {
  const expected =
    context.case.expected !== undefined
      ? `\n\nExpected / reference answer:\n${JSON.stringify(context.case.expected)}`
      : '';

  return [
    'You are grading the output of an LLM application against a rubric.',
    '',
    `Rubric: ${criteria}`,
    '',
    `Input given to the application:\n${JSON.stringify(context.case.input)}`,
    `${expected}`,
    '',
    `Application output to grade:\n${context.output}`,
    '',
    RESPONSE_FORMAT_INSTRUCTIONS,
  ].join('\n');
}

function parseJudgeResponse(rawOutput: string): { score: number; reason?: string } {
  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new PromptProofError(
      `Judge response did not contain a JSON object. Raw response: ${rawOutput}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new PromptProofError(
      `Judge response contained malformed JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('score' in parsed) ||
    typeof parsed.score !== 'number'
  ) {
    throw new PromptProofError(
      `Judge response JSON is missing a numeric "score" field. Raw response: ${rawOutput}`,
    );
  }

  const { score, reason } = parsed as { score: number; reason?: unknown };
  return { score, ...(typeof reason === 'string' ? { reason } : {}) };
}

/**
 * Passes when an LLM judge scores the output at or above `threshold` against
 * a natural-language rubric — useful for qualities (tone, faithfulness,
 * helpfulness) that resist exact or embedding-based comparison.
 *
 * The judge call and its parsing are isolated per case: a judge that errors
 * or replies with unparseable output fails just that case, with the failure
 * reason attached, rather than throwing out of the grader.
 *
 * @example
 * ```ts
 * llmJudge({
 *   criteria: 'The answer must not contradict the provided context.',
 *   judge: anthropicAdapter({ model: 'claude-haiku-4-5' }),
 *   threshold: 0.8,
 * });
 * ```
 */
export function llmJudge(options: LlmJudgeOptions): Grader {
  const name = options.name ?? 'llmJudge';
  const threshold = options.threshold ?? 0.7;

  return {
    name,
    async grade(context) {
      const prompt = buildJudgePrompt(options.criteria, context);

      // The judge is called with the rendered prompt as its own case input —
      // it never sees the SUT's (arbitrarily typed) original case input.
      const judgeCase: SuiteCase<string> = { id: context.case.id, input: prompt };

      let rawOutput: string;
      try {
        const judgeResult = await options.judge(prompt, { case: judgeCase });
        rawOutput = judgeResult.output;
      } catch (error) {
        return {
          pass: false,
          reason: `Judge call failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      let parsed: { score: number; reason?: string };
      try {
        parsed = parseJudgeResponse(rawOutput);
      } catch (error) {
        return {
          pass: false,
          reason: error instanceof Error ? error.message : String(error),
        };
      }

      const score = Math.min(1, Math.max(0, parsed.score));
      const pass = score >= threshold;

      return {
        pass,
        score,
        ...(parsed.reason ? { reason: parsed.reason } : {}),
      };
    },
  };
}
