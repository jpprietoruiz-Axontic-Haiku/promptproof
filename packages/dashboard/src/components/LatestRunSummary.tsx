import type { RunSummary } from '../data/types';

export interface LatestRunSummaryProps {
  readonly run: RunSummary;
}

export function LatestRunSummary({ run }: LatestRunSummaryProps) {
  return (
    <section className="latest-run">
      <h3>
        Latest run — {run.version} <span className="muted">({run.date})</span>
      </h3>

      <dl className="stat-grid">
        <div>
          <dt>Pass rate</dt>
          <dd>{(run.passRate * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Mean latency</dt>
          <dd>{run.meanLatencyMs.toFixed(0)}ms</dd>
        </div>
        <div>
          <dt>P95 latency</dt>
          <dd>{run.p95LatencyMs.toFixed(0)}ms</dd>
        </div>
        {run.totalCostUsd !== undefined && (
          <div>
            <dt>Total cost</dt>
            <dd>${run.totalCostUsd.toFixed(4)}</dd>
          </div>
        )}
      </dl>

      <table>
        <thead>
          <tr>
            <th>Grader</th>
            <th>Pass rate</th>
            <th>Mean score</th>
          </tr>
        </thead>
        <tbody>
          {run.byGrader.map((grader) => (
            <tr key={grader.grader}>
              <td>{grader.grader}</td>
              <td>{(grader.passRate * 100).toFixed(1)}%</td>
              <td>
                {grader.meanScore !== undefined ? grader.meanScore.toFixed(3) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
