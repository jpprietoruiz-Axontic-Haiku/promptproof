/**
 * A single evaluation case: one input sent through the system under test,
 * with an optional expected value used by comparison-based graders.
 *
 * @typeParam TInput - Shape of the input sent to the {@link Adapter}.
 * @typeParam TExpected - Shape of the expected value, if any.
 */
export interface SuiteCase<TInput = unknown, TExpected = unknown> {
  /** Stable, unique (within the suite) identifier for this case. */
  readonly id: string;
  /** Human-readable label shown in reports. */
  readonly name?: string;
  /** Value passed to the adapter. */
  readonly input: TInput;
  /** Expected value, consumed by graders such as `exactMatch` or `semanticSimilarity`. */
  readonly expected?: TExpected;
  /** Free-form tags for filtering/grouping in reports. */
  readonly tags?: readonly string[];
  /** Arbitrary metadata carried through to results, untouched by the runner. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Token/cost accounting for a single adapter call. */
export interface CostInfo {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  /** Total cost in USD, when computable (requires a pricing table). */
  readonly totalCostUsd?: number;
}

/** What an {@link Adapter} returns for a single case. */
export interface AdapterResult {
  /** Raw text output of the system under test. Graders operate on this. */
  readonly output: string;
  /**
   * Wall-clock latency in milliseconds, as measured by the adapter itself.
   * If omitted, the runner measures the time spent awaiting the adapter call.
   */
  readonly latencyMs?: number;
  readonly cost?: CostInfo;
  /** Unprocessed provider response, kept for debugging — not used by graders. */
  readonly raw?: unknown;
}

/** Context passed to an {@link Adapter} alongside the case input. */
export interface AdapterCallInfo<TInput = unknown, TExpected = unknown> {
  readonly case: SuiteCase<TInput, TExpected>;
  readonly signal?: AbortSignal;
}

/**
 * Runs a single case against the system under test.
 *
 * An adapter is just a function — `openaiAdapter()` and `anthropicAdapter()`
 * build one for you, and a "custom adapter" is simply any function matching
 * this signature (e.g. one that calls your own API or in-process pipeline).
 */
export type Adapter<TInput = unknown, TExpected = unknown> = (
  input: TInput,
  info: AdapterCallInfo<TInput, TExpected>,
) => Promise<AdapterResult> | AdapterResult;

/** What a {@link Grader} sees for a single case's outcome. */
export interface GraderContext<TInput = unknown, TExpected = unknown> {
  readonly case: SuiteCase<TInput, TExpected>;
  readonly output: string;
  readonly latencyMs: number;
  readonly cost?: CostInfo;
}

/** The verdict a {@link Grader} returns for a single case. */
export interface GraderResult {
  readonly pass: boolean;
  /** Optional continuous score in `[0, 1]`, used by mean-score thresholds. */
  readonly score?: number;
  /** Human-readable explanation, shown in reports and failure messages. */
  readonly reason?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * A pluggable check applied to every case's output.
 *
 * Implement this directly for a fully custom grader, or use one of the
 * built-in factories (`exactMatch()`, `semanticSimilarity()`, `jsonSchema()`,
 * `llmJudge()`, `latencyUnder()`, `costUnder()`).
 */
export interface Grader<TInput = unknown, TExpected = unknown> {
  /** Unique (within the suite) name, used in reports and threshold config. */
  readonly name: string;
  grade(context: GraderContext<TInput, TExpected>): Promise<GraderResult> | GraderResult;
}

/** Aggregate requirement for a single grader across the whole suite. */
export interface GraderThreshold {
  /** Minimum fraction (`0`-`1`) of cases that must pass this grader. */
  readonly minPassRate?: number;
  /** Minimum mean score across cases that reported a `score`. */
  readonly minMeanScore?: number;
}

/**
 * Gating configuration for a suite. A suite "passes" when every configured
 * threshold is met; {@link run} always computes results regardless of
 * thresholds, so you can inspect a run even when it fails the gate.
 */
export interface SuiteThresholds {
  /** Minimum fraction of cases where *every* grader passed. Defaults to `1`. */
  readonly passRate?: number;
  /** Per-grader requirements, keyed by grader name. */
  readonly graders?: Readonly<Record<string, GraderThreshold>>;
}

/** Input accepted by {@link defineSuite}. */
export interface SuiteDefinition<TInput = unknown, TExpected = unknown> {
  readonly name: string;
  readonly description?: string;
  /** Free-form version label (e.g. a git SHA or semver) recorded on every run. */
  readonly version?: string;
  readonly cases: ReadonlyArray<SuiteCase<TInput, TExpected>>;
  readonly graders: ReadonlyArray<Grader<TInput, TExpected>>;
  readonly thresholds?: SuiteThresholds;
}

/**
 * A validated, immutable suite produced by {@link defineSuite}.
 * Pass this to {@link run} together with an adapter.
 */
export type Suite<TInput = unknown, TExpected = unknown> = Readonly<
  SuiteDefinition<TInput, TExpected>
>;
