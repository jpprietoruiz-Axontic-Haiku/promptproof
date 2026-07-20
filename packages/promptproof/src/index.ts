/**
 * PromptProof — eval toolkit for LLM apps.
 *
 * @packageDocumentation
 */

export const VERSION = '0.1.0';

export { defineSuite } from './core/define-suite.js';
export { run } from './core/run.js';
export { PromptProofError } from './core/errors.js';

export type {
  Adapter,
  AdapterCallInfo,
  AdapterResult,
  CostInfo,
  Grader,
  GraderContext,
  GraderResult,
  GraderThreshold,
  Suite,
  SuiteCase,
  SuiteDefinition,
  SuiteThresholds,
} from './core/types.js';

export type {
  CaseResult,
  GraderAggregate,
  GraderOutcome,
  SerializedError,
  SuiteAggregates,
  SuiteRunResult,
  ThresholdFailure,
} from './core/results.js';

export type { RunOptions } from './core/run.js';

export { anthropicAdapter, openaiAdapter, toMessages } from './adapters/index.js';
export type {
  AnthropicAdapterOptions,
  ChatMessage,
  OpenAIAdapterOptions,
  PromptInput,
  TokenPricing,
} from './adapters/index.js';
