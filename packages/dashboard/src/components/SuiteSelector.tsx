export interface SuiteSelectorProps {
  readonly suites: ReadonlyArray<{ suiteName: string }>;
  readonly value: string;
  readonly onChange: (suiteName: string) => void;
}

export function SuiteSelector({ suites, value, onChange }: SuiteSelectorProps) {
  return (
    <label className="suite-selector">
      <span>Suite</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {suites.map((suite) => (
          <option key={suite.suiteName} value={suite.suiteName}>
            {suite.suiteName}
          </option>
        ))}
      </select>
    </label>
  );
}
