import type { Grader } from '../core/types.js';

export interface SemanticSimilarityOptions {
  /** Minimum cosine similarity (`0`-`1`) required to pass. Defaults to `0.8`. */
  readonly threshold?: number;
  /**
   * Turns text into an embedding vector, e.g. `text => openai.embeddings.create(...)`.
   * When omitted, falls back to a dependency-free bag-of-words cosine
   * similarity — good enough to catch gross drift, but no substitute for a
   * real embedding model on nuanced paraphrases.
   */
  readonly embedder?: (text: string) => Promise<readonly number[]> | readonly number[];
  /** Grader name, used in reports and threshold config. Defaults to `'semanticSimilarity'`. */
  readonly name?: string;
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const length = Math.max(a.length, b.length);
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    magnitudeA += x * x;
    magnitudeB += y * y;
  }

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function termFrequencies(text: string): Map<string, number> {
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const frequencies = new Map<string, number>();
  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  return frequencies;
}

function bagOfWordsCosine(a: string, b: string): number {
  const freqA = termFrequencies(a);
  const freqB = termFrequencies(b);
  const vocabulary = new Set([...freqA.keys(), ...freqB.keys()]);
  const vectorA: number[] = [];
  const vectorB: number[] = [];

  for (const term of vocabulary) {
    vectorA.push(freqA.get(term) ?? 0);
    vectorB.push(freqB.get(term) ?? 0);
  }

  return cosineSimilarity(vectorA, vectorB);
}

/**
 * Passes when the output is semantically close enough to `case.expected`,
 * measured as cosine similarity between embeddings (or a lexical fallback).
 *
 * @example
 * ```ts
 * semanticSimilarity({
 *   threshold: 0.85,
 *   embedder: (text) => embed(text), // e.g. OpenAI text-embedding-3-small
 * });
 * ```
 */
export function semanticSimilarity(
  options: SemanticSimilarityOptions = {},
): Grader<unknown, string> {
  const name = options.name ?? 'semanticSimilarity';
  const threshold = options.threshold ?? 0.8;

  return {
    name,
    async grade({ case: suiteCase, output }) {
      if (suiteCase.expected === undefined) {
        return {
          pass: false,
          reason: `Case "${suiteCase.id}" has no \`expected\` value to compare against.`,
        };
      }

      const similarity = options.embedder
        ? cosineSimilarity(
            await options.embedder(output),
            await options.embedder(suiteCase.expected),
          )
        : bagOfWordsCosine(output, suiteCase.expected);

      const pass = similarity >= threshold;

      return {
        pass,
        score: similarity,
        ...(pass
          ? {}
          : {
              reason: `Similarity ${similarity.toFixed(3)} is below threshold ${threshold}.`,
            }),
      };
    },
  };
}
