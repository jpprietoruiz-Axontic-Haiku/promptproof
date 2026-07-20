import { PromptProofError } from '../core/errors.js';
import type { Adapter, AdapterResult } from '../core/types.js';
import { computeCost, type TokenPricing } from './pricing.js';
import { toMessages, type PromptInput } from './types.js';

/** The subset of the `openai` client's surface this adapter relies on. */
interface MinimalOpenAIClient {
  chat: {
    completions: {
      create: (params: Record<string, unknown>) => Promise<{
        choices: Array<{ message: { content: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      }>;
    };
  };
}

export interface OpenAIAdapterOptions {
  readonly model: string;
  /** Defaults to `process.env.OPENAI_API_KEY`. */
  readonly apiKey?: string;
  /** Override for OpenAI-compatible endpoints (Azure, local proxies, etc.). */
  readonly baseURL?: string;
  /** Prepended as a system message when the case input doesn't already have one. */
  readonly systemPrompt?: string;
  readonly temperature?: number;
  /** Enables `cost.totalCostUsd` on results. */
  readonly pricing?: TokenPricing;
  /**
   * Pre-configured client to use instead of constructing one from `apiKey`.
   * Useful for tests and for routing through custom infrastructure. Skips
   * the dynamic `import('openai')` entirely.
   */
  readonly client?: MinimalOpenAIClient;
}

type OpenAIModule = {
  default: new (config: Record<string, unknown>) => MinimalOpenAIClient;
};

async function loadClient(options: OpenAIAdapterOptions): Promise<MinimalOpenAIClient> {
  if (options.client) {
    return options.client;
  }

  let openaiModule: OpenAIModule;
  try {
    openaiModule = (await import('openai')) as unknown as OpenAIModule;
  } catch (error) {
    throw new PromptProofError(
      'openaiAdapter() requires the "openai" package. Install it with `npm install openai`.',
      { cause: error },
    );
  }

  const apiKey = options.apiKey ?? process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new PromptProofError(
      'openaiAdapter() needs an API key: pass { apiKey } or set the OPENAI_API_KEY environment variable.',
    );
  }

  return new openaiModule.default({
    apiKey,
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
  });
}

/**
 * Adapter for the OpenAI Chat Completions API.
 *
 * @example
 * ```ts
 * const adapter = openaiAdapter({ model: 'gpt-4o-mini', systemPrompt: 'Be concise.' });
 * const result = await run(suite, { adapter });
 * ```
 */
export function openaiAdapter(options: OpenAIAdapterOptions): Adapter<PromptInput> {
  let clientPromise: Promise<MinimalOpenAIClient> | undefined;

  return async (input: PromptInput): Promise<AdapterResult> => {
    clientPromise ??= loadClient(options);
    const client = await clientPromise;
    const messages = toMessages(input, options.systemPrompt);

    const start = performance.now();
    const response = await client.chat.completions.create({
      model: options.model,
      messages,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    });
    const latencyMs = performance.now() - start;

    const output = response.choices[0]?.message.content ?? '';
    const cost = computeCost(
      response.usage?.prompt_tokens,
      response.usage?.completion_tokens,
      options.pricing,
    );

    return { output, latencyMs, ...(cost ? { cost } : {}) };
  };
}
