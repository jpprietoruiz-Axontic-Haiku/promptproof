import pc from 'picocolors';
import type { RegressionReport } from '../core/compare.js';
import type { SuiteRunResult } from '../core/results.js';

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMs(value: number): string {
  return `${value.toFixed(0)}ms`;
}

/**
 * Renders a {@link SuiteRunResult} as a human-readable, colorized console
 * report. Pass `regressionReport` (from {@link compareRuns}) to also render
 * a "vs baseline" section.
 */
export function formatReport(
  result: SuiteRunResult,
  regressionReport?: RegressionReport,
): string {
  const lines: string[] = [];

  const title = result.suiteVersion
    ? `${result.suiteName} @ ${result.suiteVersion}`
    : result.suiteName;
  lines.push(pc.bold(title));
  lines.push(
    pc.dim(`${result.aggregates.total} case(s) · ${formatMs(result.durationMs)} total`),
  );
  lines.push('');

  for (const caseResult of result.cases) {
    const icon = caseResult.pass ? pc.green('✓') : pc.red('✗');
    const label = caseResult.case.name ?? caseResult.case.id;
    lines.push(`  ${icon} ${label}`);

    if (!caseResult.pass) {
      if (caseResult.error) {
        lines.push(pc.red(`      error: ${caseResult.error.message}`));
      }
      for (const graderResult of caseResult.graderResults.filter((g) => !g.pass)) {
        lines.push(
          pc.red(`      ${graderResult.grader}: ${graderResult.reason ?? 'failed'}`),
        );
      }
    }
  }

  lines.push('');
  lines.push(pc.bold('Graders'));
  for (const graderAggregate of result.aggregates.byGrader) {
    const status =
      graderAggregate.passRate === 1 ? pc.green('PASS') : pc.yellow('PARTIAL');
    const scoreSuffix =
      graderAggregate.meanScore !== undefined
        ? `, mean score ${graderAggregate.meanScore.toFixed(3)}`
        : '';
    lines.push(
      `  ${status}  ${graderAggregate.grader}: ${graderAggregate.passed}/${graderAggregate.total} ` +
        `(${formatPercent(graderAggregate.passRate)})${scoreSuffix}`,
    );
  }

  lines.push('');
  lines.push(pc.bold('Aggregates'));
  lines.push(
    `  pass rate:     ${formatPercent(result.aggregates.passRate)} ` +
      `(${result.aggregates.passed}/${result.aggregates.total})`,
  );
  lines.push(`  mean latency:  ${formatMs(result.aggregates.meanLatencyMs)}`);
  lines.push(`  p95 latency:   ${formatMs(result.aggregates.p95LatencyMs)}`);
  if (result.aggregates.totalCostUsd !== undefined) {
    lines.push(`  total cost:    $${result.aggregates.totalCostUsd.toFixed(6)}`);
  }

  lines.push('');
  if (result.thresholdResult.pass) {
    lines.push(pc.bold(pc.green('✓ Thresholds passed')));
  } else {
    lines.push(pc.bold(pc.red('✗ Thresholds failed')));
    for (const failure of result.thresholdResult.failures) {
      lines.push(pc.red(`  - ${failure.message}`));
    }
  }

  if (regressionReport) {
    lines.push('');
    if (regressionReport.regressed) {
      lines.push(pc.bold(pc.red('✗ Regression vs baseline')));
      for (const check of regressionReport.checks.filter((c) => c.regressed)) {
        lines.push(pc.red(`  - ${check.message}`));
      }
    } else {
      lines.push(pc.bold(pc.green('✓ No regression vs baseline')));
    }
  }

  return lines.join('\n');
}
