import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ChartSeries {
  readonly key: string;
  readonly label: string;
  readonly color: string;
}

export interface TimeSeriesChartProps {
  readonly title: string;
  readonly data: ReadonlyArray<Record<string, string | number>>;
  readonly series: readonly ChartSeries[];
  readonly yFormatter?: (value: number) => string;
}

export function TimeSeriesChart({
  title,
  data,
  series,
  yFormatter,
}: TimeSeriesChartProps) {
  return (
    <section className="chart-card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={data as Record<string, string | number>[]}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="version" stroke="var(--muted)" fontSize={12} />
          <YAxis
            stroke="var(--muted)"
            fontSize={12}
            width={56}
            {...(yFormatter ? { tickFormatter: yFormatter } : {})}
          />
          <Tooltip
            formatter={(value: number) => (yFormatter ? yFormatter(value) : value)}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />
          <Legend />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
