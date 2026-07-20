# Design decisions

Why PromptProof is built the way it is, in the order a reader would hit these questions.

## Composable graders

A `Grader` is `{ name, grade(context) }`, where `grade` returns `{ pass, score?, reason?,
details? }`. That's the entire contract. Every built-in grader (`exactMatch`,
`semanticSimilarity`, `jsonSchema`, `latencyUnder`, `costUnder`, `llmJudge`) is a factory
function returning one, and nothing about the runner treats them specially — `run()`
calls `grade()` for every grader on every case and aggregates the results. A user-defined
grader is exactly as capable as a built-in one.

Three consequences fell out of keeping that contract minimal:

- **Grader output is fixed to a string.** `GraderContext.output` is always `string`, not
  a generic `TOutput`. Early drafts made output generic too, matching input/expected, but
  that meant every grader had to be written against an unknown output shape, and
  `jsonSchema()` — which needs to parse the string as JSON anyway — gained nothing from
  it. Treating "the model's raw text" as the one true output type, and letting graders
  like `jsonSchema()` parse structure out of it themselves, matches how eval tools in
  this space (promptfoo, autoevals) already model it, and it collapsed a whole axis of
  generic-inference pain in `defineSuite()`/`run()` (see the `NoInfer` note below).
- **Failures are isolated per grader, not per case.** If one grader throws, `run()`
  records that grader's outcome as a failure with the error message as the `reason` and
  keeps evaluating the rest — a flaky `llmJudge()` call doesn't take down `exactMatch()`
  results for the same case. Same logic for the adapter: a case whose adapter call throws
  is recorded as failed with the error attached, not aborted from the run.
- **Thresholds are declarative and separate from grading.** A grader answers "did this
  case pass," full stop; whether the _suite_ passes is a separate question answered by
  `SuiteThresholds` (`passRate`, per-grader `minPassRate`/`minMeanScore`). That split is
  what makes `compareRuns()` possible without touching grader code at all — thresholds
  and regression checks both just consume `SuiteRunResult.aggregates`.

**The `NoInfer` trick.** `defineSuite({ cases, graders })` and `run(suite, { adapter })`
both take multiple properties that could each independently drive TypeScript's generic
inference for `TInput`/`TExpected`. Since built-in graders and adapters are usually
_type-agnostic_ (`Grader<unknown, unknown>`, matching any case shape), letting them
participate in inference pulled the inferred type down to `unknown` even when `cases`
alone made it obvious the type should be `string`. Both functions now infer `TInput`/
`TExpected` from `cases`/`suite` only, and wrap the `graders`/`adapter` parameter types in
`NoInfer<...>` so they're checked against that inferred type instead of widening it. This
is a real, reproducible failure mode of "generic-friendly plugin + concrete data" APIs in
TypeScript, not a hypothetical — it broke the very first suite defined in this repo's own
test suite.

## Defining a regression

`SuiteThresholds` (on the suite) and `RegressionThresholds` (passed to `compareRuns()`)
answer two different questions, and conflating them was the first design mistake caught
while dogfooding the CLI:

- **Thresholds** ask "is this run good enough on its own?" — e.g. "pass rate must be at
  least 95%." A suite can meet its thresholds on every single run for months.
- **Regression** asks "did this run get worse than the last one?" — meaningful even when
  both runs pass their thresholds. A suite sliding from 100% to 96% pass rate is a real
  signal worth blocking a PR over, even though 96% might still clear a 95% threshold.

`compareRuns(baseline, current, thresholds?)` is a pure function over two
`SuiteRunResult`s, deliberately independent from `run()` and from `SuiteThresholds`, so
it's usable outside the CLI too. Its defaults are asymmetric on purpose:

- **Pass rate regresses on _any_ drop by default** (`maxPassRateDrop: 0`). The entire
  pitch of PromptProof is "quality shouldn't silently get worse," so the pass-rate check
  is the one thing that's on unconditionally.
- **Latency and cost checks are off by default** (`maxLatencyIncreasePct`/
  `maxCostIncreasePct` are `undefined`, meaning "don't check"). Both vary run-to-run for
  reasons that have nothing to do with the code under test — provider load, network
  jitter, which model tier happened to answer. Defaulting them to strict would make CI
  flaky for reasons a contributor can't fix by changing their code, which erodes trust in
  the gate faster than it protects anything. Turn them on explicitly once you know your
  suite's baseline noise.
- **Per-grader tolerances are opt-in**, keyed by grader name, for the same reason: a
  suite with a genuinely noisy `llmJudge()` grader might need slack that `exactMatch()`
  never should.

**Baseline is a committed JSON snapshot, not a live database.** GitHub Actions runners
are ephemeral — there's no persistent SQLite file to compare against between CI runs
without extra infrastructure. Rather than requiring a hosted database just to gate PRs,
`promptproof run --baseline <path>` reads a plain JSON file (the exact shape `--json`
writes), and this repo's own workflows keep `.promptproof/baseline.json` current by
running the suite on every push to `main` and committing the result
(`.github/workflows/promptproof-baseline.yml`). That keeps the regression gate
reproducible from a clean checkout, diffable in PRs like any other committed file, and
free to run — no server, no secrets beyond what the suite itself needs. SQLite (and
optionally Postgres) persistence still exists via `promptproof/persistence`, but it backs
local history and the dashboard, not CI gating.

## Cost and latency as first-class metrics

Every `AdapterResult` carries `latencyMs` and an optional `cost` alongside `output`, and
`SuiteAggregates` always reports `meanLatencyMs`/`p95LatencyMs`, computing `totalCostUsd`
whenever cases report cost — not as fields bolted onto a correctness-only result type
after the fact. `latencyUnder()` and `costUnder()` are built-in graders, not something you
have to hand-roll, and `compareRuns()` supports gating on both. Two consequences of
treating them as equals to correctness rather than side data:

- **`costUnder()` fails loudly, not silently, when cost data is missing.** If the adapter
  didn't report `cost.totalCostUsd` (no `pricing` table was configured), the grader fails
  with a reason explaining why, instead of passing vacuously. A cost gate that silently
  no-ops when misconfigured is worse than no cost gate.
- **No pricing table is baked into the library.** Provider prices change often and vary
  by account/agreement, so `computeCost()` only produces `totalCostUsd` when you pass a
  `pricing: { inputPerMillionUsd, outputPerMillionUsd }` table explicitly to an adapter.
  Shipping a hardcoded table would go stale and quietly misreport cost — an explicit
  opt-in is more honest than a plausible-looking wrong number.

## Zero required runtime dependencies for consumers who don't need them

The published `promptproof` package has exactly one real runtime dependency — `ajv`, for
`jsonSchema()`, because hand-rolling JSON Schema validation would be worse than depending
on the standard tool for it. Everything else is opt-in:

- `openai` and `@anthropic-ai/sdk` are `peerDependencies` with `peerDependenciesMeta:
{ optional: true }` and loaded via dynamic `import()` inside the adapter factories —
  installing neither costs nothing, and calling `openaiAdapter()` without `openai`
  installed fails with an actionable error (`npm install openai`) rather than a cryptic
  module-resolution stack trace.
- SQLite persistence (`better-sqlite3`, a native module) lives behind the
  `promptproof/persistence` subpath export with its own `tsup` build entry, entirely
  separate from the main `promptproof` entry point. Importing `defineSuite`/`run`/graders
  never touches it. This matters concretely for the dashboard: if `SqliteRunStore` were
  exported from the main index, any browser bundler pulling in `promptproof` for its
  types would choke on a native Node addon it can never load.
- `jiti` (for loading `.ts` config files without a build step) and `picocolors` (console
  color) are real dependencies of the CLI, but the CLI is a separate entry point
  (`dist/cli/index.js`) from the library — using `defineSuite`/`run` programmatically
  never loads either.

## Monorepo and tooling choices

- **npm workspaces over pnpm/turborepo.** The monorepo is three packages plus examples —
  small enough that workspace-aware npm covers everything needed (shared `node_modules`,
  cross-package `file:`-style resolution via symlinks, running scripts across workspaces)
  without adding a second package manager or a build-orchestration tool to explain.
- **tsup for the library, plain `tsc`+Vite for the dashboard.** The library needs dual
  ESM/CJS output with `.d.ts` for npm consumers; tsup (esbuild under the hood) does that
  in one config with no hand-written Rollup. The dashboard is an app, not a package other
  code imports, so it only needs Vite's own bundler — no dual-format concern.
- **Vitest over Jest.** Native ESM and TypeScript without a transpile step, and it's
  already the tool the `defineConfig` DX in this README is modeled after using
  (`vitest.config.ts` mirrors `promptproof.config.ts`'s own `defineConfig` pattern).
- **`exactOptionalPropertyTypes: true`.** This is the strictest optional-property setting
  TypeScript has, and it caught a real class of bug during development: code that built
  result objects by unconditionally assigning `reason: maybeUndefinedString` instead of
  omitting the key. Every optional field in this codebase is either present with a real
  value or absent — never present-but-`undefined` — which is also what `JSON.stringify`
  assumes (`JSON.stringify({ a: undefined })` drops the key), so the type system and the
  wire format agree.
- **Node's built-in `node:util` `parseArgs` over commander/yargs.** The CLI has one
  subcommand with a handful of flags; a dependency-free parser already in Node 18+
  covers it, and pulling in a full CLI framework for that surface would be the kind of
  unjustified abstraction this project explicitly argues against by having a CI gate for
  quality in the first place.
