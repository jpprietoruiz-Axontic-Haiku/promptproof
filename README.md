# PromptProof

> Eval toolkit for LLM apps: measure faithfulness, hallucination rate, latency and cost
> between versions, and gate CI on regressions.

[![CI](https://github.com/jpprieto/promptproof/actions/workflows/ci.yml/badge.svg)](https://github.com/jpprieto/promptproof/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/promptproof.svg)](https://www.npmjs.com/package/promptproof)
[![license](https://img.shields.io/npm/l/promptproof.svg)](./LICENSE)

> **Status:** work in progress. This README is a skeleton, filled in milestone by
> milestone as the project is built. See [DECISIONS.md](./DECISIONS.md) for the design
> rationale once it lands.

## Why

Most teams ship LLM features without evaluation, and find out about quality regressions
from users instead of from CI. PromptProof lets you define an evaluation suite next to
your prompts, run it locally or in CI, and fail the build when faithfulness drops,
hallucinations increase, latency regresses, or cost creeps up.

## Packages

This is a monorepo:

| Package                                          | Description                                           |
| ------------------------------------------------ | ----------------------------------------------------- |
| [`packages/promptproof`](./packages/promptproof) | Core library + CLI, published to npm as `promptproof` |
| [`packages/dashboard`](./packages/dashboard)     | React + Vite demo dashboard (deployed to Vercel)      |
| [`action`](./action)                             | GitHub Action for CI regression gating                |
| [`examples`](./examples)                         | Example suites, including one evaluating ClauseLens   |

## Quickstart

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
npx promptproof run
```

## GitHub Action

Gate every PR on regressions vs a committed baseline. The action runs
`promptproof run --baseline <path>` and fails the check if the suite's own
thresholds fail or if any configured metric regressed vs the baseline.

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
      - uses: jpprieto/promptproof/action@v0.1.0
        with:
          config: promptproof.config.ts
          baseline: .promptproof/baseline.json
```

Keep `.promptproof/baseline.json` up to date with a second workflow that runs
on every push to `main` and commits the fresh result — see
[`.github/workflows/promptproof-baseline.yml`](./.github/workflows/promptproof-baseline.yml)
in this repo for a working example (it also doubles as this project's own
self-check, via [`examples/selfcheck-suite`](./examples/selfcheck-suite)).

## Development

```bash
npm install
npm run build
npm test
npm run lint
npm run typecheck
```

Requires Node.js >= 18.18. Copy `.env.example` to `.env` and fill in the keys you need
(only required for adapters/graders that call a real LLM provider).

## License

MIT
