import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openaiAdapter } from '../../src/adapters/openai.js';
import { PromptProofError } from '../../src/core/errors.js';

const createSpy = vi
  .fn()
  .mockResolvedValue({ choices: [{ message: { content: 'mocked' } }] });
const OpenAICtorSpy = vi.fn().mockImplementation(() => ({
  chat: { completions: { create: createSpy } },
}));

vi.mock('openai', () => ({ default: OpenAICtorSpy }));

describe('openaiAdapter', () => {
  const originalApiKey = process.env['OPENAI_API_KEY'];

  beforeEach(() => {
    delete process.env['OPENAI_API_KEY'];
    OpenAICtorSpy.mockClear();
    createSpy.mockClear();
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env['OPENAI_API_KEY'];
    else process.env['OPENAI_API_KEY'] = originalApiKey;
  });

  it('lazily loads the "openai" package at most once per adapter instance', async () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    const adapter = openaiAdapter({ model: 'gpt-4o-mini' });

    await adapter('one', { case: { id: 'a', input: 'one' } });
    await adapter('two', { case: { id: 'b', input: 'two' } });

    expect(OpenAICtorSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it('sends the system prompt and case input, and extracts the output text', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'the answer' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    const client = { chat: { completions: { create } } };

    const adapter = openaiAdapter({
      model: 'gpt-4o-mini',
      systemPrompt: 'Be concise.',
      client,
    });

    const result = await adapter('What is 2+2?', {
      case: { id: 'a', input: 'What is 2+2?' },
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'What is 2+2?' },
        ],
      }),
    );
    expect(result.output).toBe('the answer');
    expect(result.cost).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(typeof result.latencyMs).toBe('number');
  });

  it('computes totalCostUsd when pricing is provided', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'hi' } }],
      usage: { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 },
    });
    const client = { chat: { completions: { create } } };

    const adapter = openaiAdapter({
      model: 'gpt-4o-mini',
      client,
      pricing: { inputPerMillionUsd: 1, outputPerMillionUsd: 2 },
    });

    const result = await adapter('hi', { case: { id: 'a', input: 'hi' } });
    expect(result.cost?.totalCostUsd).toBe(3);
  });

  it('handles multiple sequential calls against the same adapter instance', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ choices: [{ message: { content: 'x' } }] });
    const client = { chat: { completions: { create } } };
    const adapter = openaiAdapter({ model: 'gpt-4o-mini', client });

    await adapter('one', { case: { id: 'a', input: 'one' } });
    await adapter('two', { case: { id: 'b', input: 'two' } });

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('falls back to an empty string when the API returns no content', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ choices: [{ message: { content: null } }] });
    const client = { chat: { completions: { create } } };
    const adapter = openaiAdapter({ model: 'gpt-4o-mini', client });

    const result = await adapter('x', { case: { id: 'a', input: 'x' } });
    expect(result.output).toBe('');
  });

  it('throws a PromptProofError when no API key is available and no client is injected', async () => {
    const adapter = openaiAdapter({ model: 'gpt-4o-mini' });
    await expect(adapter('x', { case: { id: 'a', input: 'x' } })).rejects.toThrow(
      PromptProofError,
    );
    await expect(adapter('x', { case: { id: 'a', input: 'x' } })).rejects.toThrow(
      /OPENAI_API_KEY/,
    );
  });
});
