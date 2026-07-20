import { createLimiter } from './concurrency.js';
import { mean, percentile } from './stats.js';
import type {
  CaseResult,
  GraderAggregate,
  GraderOutcome,
  SerializedError,
  SuiteAggregates,
  SuiteRunResult,
  ThresholdFailure,
} from './results.js';
import type { Adapter, Suite, SuiteCase } from './types.js';

/** Options accepted by {@link run}. */
export interface RunOptions<TInput = unknown, TExpected = unknown> {
  /** Called once per case to produce its output. */
  readonly adapter: Adapter<TInput, TExpected>;
  /** Max number of cases evaluated concurrently. Defaults to `5`. */
  readonly concurrency?: number;
  /** Propagated to the adapter via {@link AdapterCallInfo.signal}. */
  readonly signal?: AbortSignal;
  /** Invoked as each case finishes, in completion order (not case order). */
  readonly onCaseComplete?: (result: CaseResult<TInput, TExpected>) => void;
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  return { name: 'UnknownError', message: String(error) };
}

async function runCase<TInput, TExpected>(
  suite: Suite<TInput, TExpected>,
  suiteCase: SuiteCase<TInput, TExpected>,
  options: RunOptions<TInput, TExpected>,
): Promise<CaseResult<TInput, TExpected>> {
  const callStart = performance.now();
  let adapterResult;
  try {
    adapterResult = await options.adapter(suiteCase.input, {
      case: suiteCase,
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    return {
      case: suiteCase,
      graderResults: [],
      pass: false,
      error: serializeError(error),
    };
  }

  const latencyMs = adapterResult.latencyMs ?? performance.now() - callStart;

  const graderResults: GraderOutcome[] = [];
  for (const grader of suite.graders) {
    try {
      const outcome = await grader.grade({
        case: suiteCase,
        output: adapterResult.output,
        latencyMs,
        ...(adapterResult.cost ? { cost: adapterResult.cost } : {}),
      });
      graderResults.push({ grader: grader.name, ...outcome });
    } catch (error) {
      const serialized = serializeError(error);
      graderResults.push({
        grader: grader.name,
        pass: false,
        reason: `Grader threw: ${serialized.message}`,
      });
    }
  }

  return {
    case: suiteCase,
    output: adapterResult.output,
    latencyMs,
    ...(adapterResult.cost ? { cost: adapterResult.cost } : {}),
    graderResults,
    pass: graderResults.every((outcome) => outcome.pass),
  };
}

function computeAggregates<TInput, TExpected>(
  suite: Suite<TInput, TExpected>,
  caseResults: readonly CaseResult<TInput, TExpected>[],
): SuiteAggregates {
  const total = caseResults.length;
  const passed = caseResults.filter((result) => result.pass).length;

  const latencies = caseResults
    .map((result) => result.latencyMs)
    .filter((value): value is number => typeof value === 'number');

  const costs = caseResults
    .map((result) => result.cost?.totalCostUsd)
    .filter((value): value is number => typeof value === 'number');

  const byGrader: GraderAggregate[] = suite.graders.map((grader) => {
    const outcomes = caseResults.flatMap((result) =>
      result.graderResults.filter((outcome) => outcome.grader === grader.name),
    );
    const graderPassed = outcomes.filter((outcome) => outcome.pass).length;
    const scores = outcomes
      .map((outcome) => outcome.score)
      .filter((value): value is number => typeof value === 'number');

    return {
      grader: grader.name,
      total: outcomes.length,
      passed: graderPassed,
      failed: outcomes.length - graderPassed,
      passRate: outcomes.length === 0 ? 0 : graderPassed / outcomes.length,
      ...(scores.length > 0 ? { meanScore: mean(scores) } : {}),
    };
  });

  return {
    total,
    passed,
    failed: total - passed,
    passRate: total === 0 ? 0 : passed / total,
    meanLatencyMs: mean(latencies),
    p95LatencyMs: percentile(latencies, 95),
    ...(costs.length > 0 ? { totalCostUsd: costs.reduce((a, b) => a + b, 0) } : {}),
    byGrader,
  };
}

function evaluateThresholds<TInput, TExpected>(
  suite: Suite<TInput, TExpected>,
  aggregates: SuiteAggregates,
): { pass: boolean; failures: ThresholdFailure[] } {
  const failures: ThresholdFailure[] = [];
  const minPassRate = suite.thresholds?.passRate ?? 1;

  if (aggregates.passRate < minPassRate) {
    failures.push({
      kind: 'overall-pass-rate',
      expected: minPassRate,
      actual: aggregates.passRate,
      message:
        `Overall pass rate ${(aggregates.passRate * 100).toFixed(1)}% is below the ` +
        `required ${(minPassRate * 100).toFixed(1)}%.`,
    });
  }

  for (const [graderName, threshold] of Object.entries(suite.thresholds?.graders ?? {})) {
    const graderAggregate = aggregates.byGrader.find((g) => g.grader === graderName);
    if (!graderAggregate) continue;

    if (
      threshold.minPassRate !== undefined &&
      graderAggregate.passRate < threshold.minPassRate
    ) {
      failures.push({
        kind: 'grader-pass-rate',
        grader: graderName,
        expected: threshold.minPassRate,
        actual: graderAggregate.passRate,
        message:
          `Grader "${graderName}" pass rate ${(graderAggregate.passRate * 100).toFixed(1)}% ` +
          `is below the required ${(threshold.minPassRate * 100).toFixed(1)}%.`,
      });
    }

    if (threshold.minMeanScore !== undefined) {
      const meanScore = graderAggregate.meanScore ?? 0;
      if (meanScore < threshold.minMeanScore) {
        failures.push({
          kind: 'grader-mean-score',
          grader: graderName,
          expected: threshold.minMeanScore,
          actual: meanScore,
          message:
            `Grader "${graderName}" mean score ${meanScore.toFixed(3)} is below the ` +
            `required ${threshold.minMeanScore}.`,
        });
      }
    }
  }

  return { pass: failures.length === 0, failures };
}

/**
 * Runs every case in `suite` through `options.adapter`, grades each output,
 * and returns typed per-case results plus suite-wide aggregates.
 *
 * A throwing adapter or grader never aborts the run: the offending case (or
 * grader outcome) is recorded as failed with the error attached, and the
 * rest of the suite still executes.
 *
 * @example
 * ```ts
 * const result = await run(suite, { adapter: openaiAdapter({ model: 'gpt-4o-mini' }) });
 * if (!result.thresholdResult.pass) process.exitCode = 1;
 * ```
 */
export async function run<TInput = unknown, TExpected = unknown>(
  suite: Suite<TInput, TExpected>,
  // TInput/TExpected are inferred from `suite` alone; NoInfer keeps a
  // generic-agnostic adapter from widening that inference back to `unknown`.
  options: RunOptions<NoInfer<TInput>, NoInfer<TExpected>>,
): Promise<SuiteRunResult<TInput, TExpected>> {
  const concurrency = options.concurrency ?? 5;
  const limiter = createLimiter(concurrency);
  const startedAt = new Date();

  const caseResults = await Promise.all(
    suite.cases.map((suiteCase) =>
      limiter(async () => {
        const result = await runCase(suite, suiteCase, options);
        options.onCaseComplete?.(result);
        return result;
      }),
    ),
  );

  const finishedAt = new Date();
  const aggregates = computeAggregates(suite, caseResults);
  const thresholdResult = evaluateThresholds(suite, aggregates);

  return {
    suiteName: suite.name,
    ...(suite.version ? { suiteVersion: suite.version } : {}),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    cases: caseResults,
    aggregates,
    thresholdResult,
  };
}
