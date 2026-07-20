import type { RegressionThresholds } from './core/compare.js';
import type { Adapter, Suite } from './core/types.js';

/**
 * Shape of `promptproof.config.ts`: a suite plus the adapter that turns
 * cases into outputs. Kept separate from {@link Suite} so the same suite can
 * be run against different adapters (e.g. a real one locally, a mock in CI).
 */
export interface PromptProofConfig<TInput = unknown, TExpected = unknown> {
  readonly suite: Suite<TInput, TExpected>;
  readonly adapter: Adapter<TInput, TExpected>;
  /** Max cases evaluated concurrently. Defaults to `5`. */
  readonly concurrency?: number;
  /** What counts as a regression when `promptproof run --baseline <path>` compares against a prior run. */
  readonly regression?: RegressionThresholds;
}

/**
 * Identity helper for `promptproof.config.ts` — exists purely so the config
 * object gets checked against {@link PromptProofConfig} and its generics are
 * inferred, the same way `defineConfig` works in Vite/Vitest.
 *
 * @example
 * ```ts
 * // promptproof.config.ts
 * export default defineConfig({
 *   suite: mySuite,
 *   adapter: openaiAdapter({ model: 'gpt-4o-mini' }),
 * });
 * ```
 */
export function defineConfig<TInput = unknown, TExpected = unknown>(
  config: PromptProofConfig<TInput, TExpected>,
): PromptProofConfig<TInput, TExpected> {
  return config;
}
