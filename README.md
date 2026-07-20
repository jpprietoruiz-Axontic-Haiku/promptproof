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

| Package                                | Description                                            |
| --------------------------------------- | -------------------------------------------------------- |
| [`packages/promptproof`](./packages/promptproof) | Core library + CLI, published to npm as `promptproof` |
| [`packages/dashboard`](./packages/dashboard)     | React + Vite demo dashboard (deployed to Vercel)       |
| [`action`](./action)                             | GitHub Action for CI regression gating                |
| [`examples`](./examples)                         | Example suites, including one evaluating ClauseLens    |

## Quickstart

_Coming soon — landing with the CLI milestone._

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
