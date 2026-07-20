import { useMemo, useState } from 'react';
import { LatestRunSummary } from './components/LatestRunSummary';
import { SuiteSelector } from './components/SuiteSelector';
import { TimeSeriesChart } from './components/TimeSeriesChart';
import { EXAMPLE_HISTORY } from './data/example-runs';

const PASS_RATE_COLOR = '#6366f1';
const LATENCY_MEAN_COLOR = '#0ea5e9';
const LATENCY_P95_COLOR = '#f97316';
const COST_COLOR = '#22c55e';

const [firstSuite] = EXAMPLE_HISTORY;

export function App() {
  const [suiteName, setSuiteName] = useState(firstSuite.suiteName);

  const suite = useMemo(
    () =>
      EXAMPLE_HISTORY.find((candidate) => candidate.suiteName === suiteName) ??
      firstSuite,
    [suiteName],
  );

  const passRateData = suite.runs.map((run) => ({
    version: run.version,
    passRate: Math.round(run.passRate * 1000) / 10,
  }));

  const latencyData = suite.runs.map((run) => ({
    version: run.version,
    mean: run.meanLatencyMs,
    p95: run.p95LatencyMs,
  }));

  const hasCostData = suite.runs.some((run) => run.totalCostUsd !== undefined);
  const costData = suite.runs.map((run) => ({
    version: run.version,
    cost: run.totalCostUsd ?? 0,
  }));

  const latestRun = suite.runs[suite.runs.length - 1];

  return (
    <main>
      <header className="page-header">
        <h1>PromptProof Dashboard</h1>
        <p>
          Time series of eval metrics per version — demo data, bundled with this
          deployment.
        </p>
        <SuiteSelector
          suites={EXAMPLE_HISTORY}
          value={suite.suiteName}
          onChange={setSuiteName}
        />
      </header>

      <p className="suite-description">{suite.description}</p>

      {latestRun && <LatestRunSummary run={latestRun} />}

      <div className="chart-grid">
        <TimeSeriesChart
          title="Pass rate"
          data={passRateData}
          series={[{ key: 'passRate', label: 'Pass rate (%)', color: PASS_RATE_COLOR }]}
          yFormatter={(value) => `${value}%`}
        />
        <TimeSeriesChart
          title="Latency"
          data={latencyData}
          series={[
            { key: 'mean', label: 'Mean (ms)', color: LATENCY_MEAN_COLOR },
            { key: 'p95', label: 'P95 (ms)', color: LATENCY_P95_COLOR },
          ]}
          yFormatter={(value) => `${value}ms`}
        />
        {hasCostData && (
          <TimeSeriesChart
            title="Cost per run"
            data={costData}
            series={[{ key: 'cost', label: 'Total cost (USD)', color: COST_COLOR }]}
            yFormatter={(value) => `$${value.toFixed(3)}`}
          />
        )}
      </div>
    </main>
  );
}
