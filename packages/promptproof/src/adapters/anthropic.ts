import { PromptProofError } from '../core/errors.js';
import type { Adapter, AdapterResult } from '../core/types.js';
import { computeCost, type TokenPricing } from './pricing.js';
import { toMessages, type PromptInput } from './types.js';

/** The subset of the `@anthropic-ai/sdk` client's surface this adapter relies on. */
interface MinimalAnthropicClient {
  messages: {
    create: (params: Record<string, unknown>) => Promise<{
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>;
  };
}

export interface AnthropicAdapterOptions {
  readonly model: string;
  /** Defaults to `process.env.ANTHROPIC_API_KEY`. */
  readonly apiKey?: string;
  /** Sent as the top-level `system` parameter, per the Messages API. */
  readonly systemPrompt?: string;
  /** Required by the Messages API. Defaults to `1024`. */
  readonly maxTokens?: number;
  readonly temperature?: number;
  /** Enables `cost.totalCostUsd` on results. */
  readonly pricing?: TokenPricing;
  /**
   * Pre-configured client to use instead of constructing one from `apiKey`.
   * Useful for tests and for routing through custom infrastructure. Skips
   * the dynamic `import('@anthropic-ai/sdk')` entirely.
   */
  readonly client?: MinimalAnthropicClient;
}

type AnthropicModule = {
  default: new (config: Record<string, unknown>) => MinimalAnthropicClient;
};

async function loadClient(
  options: AnthropicAdapterOptions,
): Promise<MinimalAnthropicClient> {
  if (options.client) {
    return options.client;
  }

  let anthropicModule: AnthropicModule;
  try {
    anthropicModule = (await import('@anthropic-ai/sdk')) as unknown as AnthropicModule;
  } catch (error) {
    throw new PromptProofError(
      'anthropicAdapter() requires the "@anthropic-ai/sdk" package. Install it with `npm install @anthropic-ai/sdk`.',
      { cause: error },
    );
  }

  const apiKey = options.apiKey ?? process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new PromptProofError(
      'anthropicAdapter() needs an API key: pass { apiKey } or set the ANTHROPIC_API_KEY environment variable.',
    );
  }

  return new anthropicModule.default({ apiKey });
}

/**
 * Adapter for the Anthropic Messages API.
 *
 * @example
 * ```ts
 * const adapter = anthropicAdapter({ model: 'claude-sonnet-5', systemPrompt: 'Be concise.' });
 * const result = await run(suite, { adapter });
 * ```
 */
export function anthropicAdapter(options: AnthropicAdapterOptions): Adapter<PromptInput> {
  let clientPromise: Promise<MinimalAnthropicClient> | undefined;

  return async (input: PromptInput): Promise<AdapterResult> => {
    clientPromise ??= loadClient(options);
    const client = await clientPromise;

    const messages = toMessages(input, options.systemPrompt);
    const systemMessage = messages.find((message) => message.role === 'system');
    const conversation = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role, content: message.content }));

    const start = performance.now();
    const response = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 1024,
      ...(systemMessage ? { system: systemMessage.content } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      messages: conversation,
    });
    const latencyMs = performance.now() - start;

    const output = response.content
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('');
    const cost = computeCost(
      response.usage?.input_tokens,
      response.usage?.output_tokens,
      options.pricing,
    );

    return { output, latencyMs, ...(cost ? { cost } : {}) };
  };
}
