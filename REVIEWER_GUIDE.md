# PromptProof — 2-minute technical review

**What it demonstrates:** repeatable evaluation and regression checks for applications powered by large language models (LLMs). It is a portfolio/open-source engineering project; evaluation results depend on the configured datasets, adapters and judge models.

## Review the implementation

| Area | Where to look |
| --- | --- |
| Library and CLI | [Core package](packages/promptproof) |
| CI regression integration | [GitHub Action](action) |
| Sample evaluation suites | [Examples](examples) |
| Demo dashboard | [React dashboard](packages/dashboard) |
| Architecture and trade-offs | [DECISIONS.md](DECISIONS.md) |
| Continuous integration | [CI workflow](.github/workflows/ci.yml) |

## What it shows

- Configurable graders for exact match, schema validity, semantic similarity, quality, latency and cost.
- Comparison against a baseline to detect regressions, with configurable failure thresholds.
- Interfaces for different model providers and custom application adapters.
- A command-line interface and GitHub Action that integrate evaluation with software delivery.
- Automated tests and a demo dashboard with bundled example data.

## Scope and limitations

Evaluation metrics are **proxies**, not guarantees that an LLM is factually correct or safe. LLM-as-judge assessments can be biased; meaningful results require carefully curated datasets, thresholds and independent validation. The bundled dashboard uses example data. Check [CI runs](https://github.com/jpprietoruiz-Axontic-Haiku/promptproof/actions/workflows/ci.yml) before assuming the latest revision has passed.

**Author:** Juan Pablo Prieto, PhD · [GitHub profile](https://github.com/jpprietoruiz-Axontic-Haiku)
