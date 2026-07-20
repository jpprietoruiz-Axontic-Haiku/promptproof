import type { SuiteRunResult } from './results.js';

/** Regression tolerance for a single grader. */
export interface GraderRegressionThreshold {
  /** Max allowed drop (absolute, e.g. `0.02` = 2 points) in this grader's pass rate. */
  readonly maxPassRateDrop?: number;
  /** Max allowed drop in this grader's mean score. */
  readonly maxMeanScoreDrop?: number;
}

/**
 * Defines what counts as a regression between two runs of the same suite.
 * Everything is opt-in except overall pass rate, which regresses on *any*
 * drop by default — the whole point of gating CI is that quality should
 * never silently get worse. Latency/cost checks default to off since they
 * vary run-to-run for reasons unrelated to the code under test; turn them on
 * once you've established the suite's normal variance.
 */
export interface RegressionThresholds {
  /** Max allowed drop in overall pass rate. Defaults to `0` (no drop allowed). */
  readonly maxPassRateDrop?: number;
  /** Max allowed relative increase in mean latency (e.g. `0.2` = 20% slower). Unset = not checked. */
  readonly maxLatencyIncreasePct?: number;
  /** Max allowed relative increase in total cost. Unset = not checked. */
  readonly maxCostIncreasePct?: number;
  /** Per-grader tolerances, keyed by grader name. Unset = not checked. */
  readonly graders?: Readonly<Record<string, GraderRegressionThreshold>>;
}

/** Result of comparing one metric between baseline and current. */
export interface RegressionCheck {
  readonly metric: string;
  readonly baselineValue: number;
  readonly currentValue: number;
  readonly regressed: boolean;
  readonly message: string;
}

export interface RegressionReport {
  readonly regressed: boolean;
  readonly checks: readonly RegressionCheck[];
}

function relativeIncrease(baselineValue: number, currentValue: number): number {
  if (baselineValue === 0) return currentValue > 0 ? Infinity : 0;
  return (currentValue - baselineValue) / baselineValue;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Compares a `current` run against a `baseline` run of the same suite and
 * reports whether any configured metric regressed.
 *
 * @example
 * ```ts
 * const report = compareRuns(baselineResult, currentResult, {
 *   maxLatencyIncreasePct: 0.2,
 * });
 * if (report.regressed) process.exitCode = 1;
 * ```
 */
export function compareRuns(
  baseline: SuiteRunResult,
  current: SuiteRunResult,
  thresholds: RegressionThresholds = {},
): RegressionReport {
  const checks: RegressionCheck[] = [];
  const maxPassRateDrop = thresholds.maxPassRateDrop ?? 0;

  const passRateDrop = baseline.aggregates.passRate - current.aggregates.passRate;
  const passRateRegressed = passRateDrop > maxPassRateDrop;
  checks.push({
    metric: 'passRate',
    baselineValue: baseline.aggregates.passRate,
    currentValue: current.aggregates.passRate,
    regressed: passRateRegressed,
    message: passRateRegressed
      ? `Pass rate dropped from ${formatPercent(baseline.aggregates.passRate)} to ${formatPercent(current.aggregates.passRate)}.`
      : 'Pass rate did not regress.',
  });

  if (thresholds.maxLatencyIncreasePct !== undefined) {
    const baselineValue = baseline.aggregates.meanLatencyMs;
    const currentValue = current.aggregates.meanLatencyMs;
    const increasePct = relativeIncrease(baselineValue, currentValue);
    const regressed = increasePct > thresholds.maxLatencyIncreasePct;
    checks.push({
      metric: 'meanLatencyMs',
      baselineValue,
      currentValue,
      regressed,
      message: regressed
        ? `Mean latency increased ${formatPercent(increasePct)} (${baselineValue.toFixed(0)}ms → ${currentValue.toFixed(0)}ms), exceeding the allowed ${formatPercent(thresholds.maxLatencyIncreasePct)}.`
        : 'Mean latency did not regress beyond the allowed threshold.',
    });
  }

  if (
    thresholds.maxCostIncreasePct !== undefined &&
    baseline.aggregates.totalCostUsd !== undefined &&
    current.aggregates.totalCostUsd !== undefined
  ) {
    const baselineValue = baseline.aggregates.totalCostUsd;
    const currentValue = current.aggregates.totalCostUsd;
    const increasePct = relativeIncrease(baselineValue, currentValue);
    const regressed = increasePct > thresholds.maxCostIncreasePct;
    checks.push({
      metric: 'totalCostUsd',
      baselineValue,
      currentValue,
      regressed,
      message: regressed
        ? `Total cost increased ${formatPercent(increasePct)} ($${baselineValue.toFixed(6)} → $${currentValue.toFixed(6)}), exceeding the allowed ${formatPercent(thresholds.maxCostIncreasePct)}.`
        : 'Total cost did not regress beyond the allowed threshold.',
    });
  }

  for (const [graderName, graderThreshold] of Object.entries(thresholds.graders ?? {})) {
    const baselineGrader = baseline.aggregates.byGrader.find(
      (g) => g.grader === graderName,
    );
    const currentGrader = current.aggregates.byGrader.find(
      (g) => g.grader === graderName,
    );
    if (!baselineGrader || !currentGrader) continue;

    if (graderThreshold.maxPassRateDrop !== undefined) {
      const drop = baselineGrader.passRate - currentGrader.passRate;
      const regressed = drop > graderThreshold.maxPassRateDrop;
      checks.push({
        metric: `${graderName}.passRate`,
        baselineValue: baselineGrader.passRate,
        currentValue: currentGrader.passRate,
        regressed,
        message: regressed
          ? `Grader "${graderName}" pass rate dropped from ${formatPercent(baselineGrader.passRate)} to ${formatPercent(currentGrader.passRate)}.`
          : `Grader "${graderName}" pass rate did not regress.`,
      });
    }

    if (
      graderThreshold.maxMeanScoreDrop !== undefined &&
      baselineGrader.meanScore !== undefined &&
      currentGrader.meanScore !== undefined
    ) {
      const drop = baselineGrader.meanScore - currentGrader.meanScore;
      const regressed = drop > graderThreshold.maxMeanScoreDrop;
      checks.push({
        metric: `${graderName}.meanScore`,
        baselineValue: baselineGrader.meanScore,
        currentValue: currentGrader.meanScore,
        regressed,
        message: regressed
          ? `Grader "${graderName}" mean score dropped from ${baselineGrader.meanScore.toFixed(3)} to ${currentGrader.meanScore.toFixed(3)}.`
          : `Grader "${graderName}" mean score did not regress.`,
      });
    }
  }

  return { regressed: checks.some((check) => check.regressed), checks };
}
