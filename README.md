# PromptProof

> Eval toolkit for LLM apps: measure faithfulness, hallucination rate, latency and cost
> between versions, and gate CI on regressions.

[![CI](https://github.com/jpprietoruiz-Axontic-Haiku/promptproof/actions/workflows/ci.yml/badge.svg)](https://github.com/jpprietoruiz-Axontic-Haiku/promptproof/actions/workflows/ci.yml)
[![PromptProof PR Check](https://github.com/jpprietoruiz-Axontic-Haiku/promptproof/actions/workflows/promptproof-pr.yml/badge.svg)](https://github.com/jpprietoruiz-Axontic-Haiku/promptproof/actions/workflows/promptproof-pr.yml)
[![npm version](https://img.shields.io/npm/v/promptproof.svg)](https://www.npmjs.com/package/promptproof)
[![license](https://img.shields.io/npm/l/promptproof.svg)](./LICENSE)

## Why

Most teams ship LLM features without evaluation, and find out about quality regressions
from users instead of from CI. Unit tests don't help here — the same prompt against the
same model can pass today and fail tomorrow. PromptProof treats that as a testing
problem: define an evaluation suite next to your prompts, run it locally or in CI, and
fail the build when faithfulness drops, hallucinations increase, latency regresses, or
cost creeps up.

- **Composable graders.** `llmJudge`, `semanticSimilarity`, `exactMatch`, `jsonSchema`,
  `latencyUnder`, `costUnder` — or write your own in about five lines. See
  [DECISIONS.md](./DECISIONS.md#composable-graders).
- **Cost and latency are first-class metrics**, not an afterthought bolted onto a
  correctness-only tool. See [DECISIONS.md](./DECISIONS.md#cost-and-latency-as-first-class-metrics).
- **Real CI gating**, not just a report nobody reads: `promptproof run --baseline` fails
  the check when a metric regresses vs. a committed baseline. See
  [DECISIONS.md](./DECISIONS.md#defining-a-regression).
- **Zero required runtime dependencies for consumers who don't need them** — provider
  SDKs are optional peers, SQLite persistence lives behind a separate subpath so it
  never reaches browser bundles.

## Quickstart (60 seconds)

```bash
npm install promptproof openai
```

```ts
// promptproof.config.ts
import { defineConfig, defineSuite, exactMatch, openaiAdapter } from 'promptproof';

const suite = defineSuite({
  name: 'support-bot',
  cases: [{ id: 'refund', input: 'I want a refund', expected: 'refund' }],
  graders: [exactMatch()],
  thresholds: { passRate: 0.95 },
});

export default defineConfig({
  suite,
  adapter: openaiAdapter({ model: 'gpt-4o-mini' }),
});
```

```bash
export OPENAI_API_KEY=sk-...
npx promptproof run
```

That's it — `promptproof run` executes every case, grades the output, prints a console
report, and exits non-zero if the suite's thresholds fail. Add `--json result.json` to
export the full result, or `--baseline prior-result.json` to also fail on regression vs.
a prior run (see [GitHub Action](#github-action) below).

## Packages

This is a monorepo:

| Package                                          | Description                                           |
| ------------------------------------------------ | ----------------------------------------------------- |
| [`packages/promptproof`](./packages/promptproof) | Core library + CLI, published to npm as `promptproof` |
| [`packages/dashboard`](./packages/dashboard)     | React + Vite demo dashboard (deployed to Vercel)      |
| [`action`](./action)                             | GitHub Action for CI regression gating                |
| [`examples`](./examples)                         | Example suites, including one modeling ClauseLens     |

## API

```ts
defineSuite({ name, cases, graders, thresholds? }): Suite
run(suite, { adapter, concurrency?, onCaseComplete? }): Promise<SuiteRunResult>
compareRuns(baseline, current, thresholds?): RegressionReport
defineConfig({ suite, adapter, concurrency?, regression? }): PromptProofConfig
```

Every case gets an `id`, an `input` sent to the adapter, and an optional `expected`
value consumed by comparison-based graders. `run()` never lets one bad case (a throwing
adapter or grader) abort the suite — it's recorded as a failure with the error attached,
and the rest of the suite still runs. Full types are documented with TSDoc in
[`packages/promptproof/src/index.ts`](./packages/promptproof/src/index.ts) and surface
in your editor via the published `.d.ts`.

### Graders

| Grader                          | Checks                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `exactMatch()`                  | Output equals `case.expected` (optionally case/whitespace-insensitive)              |
| `semanticSimilarity()`          | Cosine similarity to `case.expected` — pluggable embedder, dependency-free fallback |
| `jsonSchema(schema)`            | Output parses as JSON and validates against a JSON Schema (via ajv)                 |
| `latencyUnder(ms)`              | Case latency is at or below `ms`                                                    |
| `costUnder(usd)`                | Case cost is at or below `usd` (fails clearly if the adapter reported no cost)      |
| `llmJudge({ criteria, judge })` | An LLM (any `Adapter`) scores the output against a rubric                           |

Writing a custom grader is exactly as much code as the built-ins — a `Grader` is just
`{ name, grade(context) }`:

```ts
const noApologies: Grader = {
  name: 'no-apologies',
  grade: ({ output }) => ({ pass: !/^(sorry|i apologize)/i.test(output) }),
};
```

### Adapters

`openaiAdapter()` and `anthropicAdapter()` ship built in and lazy-load their SDKs (listed
as optional peer dependencies — install whichever you use). A "custom adapter" is simply
any function matching the `Adapter` type, so wrapping your own API or in-process
pipeline needs no special integration:

```ts
const adapter: Adapter<string> = async (input) => {
  const start = performance.now();
  const output = await myPipeline(input);
  return { output, latencyMs: performance.now() - start };
};
```

## CLI

```bash
promptproof run [options]

  --config <path>      Config file (default: promptproof.config.{ts,mts,js,mjs,cjs})
  --json <path>        Write the full run result as JSON to <path>
  --baseline <path>    Compare against a prior --json result; fail on regression
  --db <path>          SQLite database path (default: $PROMPTPROOF_DB_PATH or ./promptproof.db)
  --no-save            Skip saving the run to SQLite
  --concurrency <n>    Override the max concurrent adapter calls
```

Every run is persisted to SQLite by default (`promptproof/persistence`, kept out of the
main entry point so browser-safe consumers never load the native binding). Point
`DATABASE_URL` at Postgres for the hosted dashboard variant.

## GitHub Action

Gate every PR on regressions vs. a committed baseline. The action runs
`promptproof run --baseline <path>` and fails the check if the suite's own thresholds
fail _or_ if any configured metric regressed vs. the baseline.

```yaml
# .github/workflows/promptproof.yml
name: PromptProof
on:
  pull_request:
    branches: [main]

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - uses: jpprietoruiz-Axontic-Haiku/promptproof/action@v0.1.0
        with:
          config: promptproof.config.ts
          baseline: .promptproof/baseline.json
```

Keep `.promptproof/baseline.json` current with a second workflow that runs on every push
to `main` and commits the fresh result — see
[`.github/workflows/promptproof-baseline.yml`](./.github/workflows/promptproof-baseline.yml)
in this repo for a working example. It also doubles as this project's own self-check: both
workflows run against [`examples/selfcheck-suite`](./examples/selfcheck-suite), a
deterministic, zero-API-key suite that exists purely to prove the pipeline end to end in
this repo's own CI (see the badges at the top of this README).

## Dashboard

`packages/dashboard` is a static React + Vite app with example data bundled in —
no backend, no environment variables, deployable to Vercel as-is. It plots pass rate,
latency, and cost per run across versions for the suites in
[`packages/dashboard/src/data/example-runs.ts`](./packages/dashboard/src/data/example-runs.ts),
including one modeling [`examples/clauselens-suite`](./examples/clauselens-suite) — a
generic stand-in for evaluating [ClauseLens](https://github.com/jpprietoruiz-Axontic-Haiku), a separate
contract-analysis project.

```bash
npm run dev --workspace packages/dashboard
```

## Development

```bash
npm install
npm run build
npm test
npm run lint
npm run typecheck
```

Requires Node.js >= 18.18. Copy `.env.example` to `.env` and fill in the keys you need
(only required for adapters/graders that call a real LLM provider — the test suite and
the bundled examples need none).

See [DECISIONS.md](./DECISIONS.md) for why the library is built the way it is.

## License

MIT
