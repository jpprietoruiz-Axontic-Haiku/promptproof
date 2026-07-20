import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anthropicAdapter } from '../../src/adapters/anthropic.js';
import { PromptProofError } from '../../src/core/errors.js';

const createSpy = vi
  .fn()
  .mockResolvedValue({ content: [{ type: 'text', text: 'mocked' }] });
const AnthropicCtorSpy = vi
  .fn()
  .mockImplementation(() => ({ messages: { create: createSpy } }));

vi.mock('@anthropic-ai/sdk', () => ({ default: AnthropicCtorSpy }));

describe('anthropicAdapter', () => {
  const originalApiKey = process.env['ANTHROPIC_API_KEY'];

  beforeEach(() => {
    delete process.env['ANTHROPIC_API_KEY'];
    AnthropicCtorSpy.mockClear();
    createSpy.mockClear();
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env['ANTHROPIC_API_KEY'];
    else process.env['ANTHROPIC_API_KEY'] = originalApiKey;
  });

  it('sends the system prompt separately and joins text content blocks', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [
        { type: 'text', text: 'part one. ' },
        { type: 'text', text: 'part two.' },
      ],
      usage: { input_tokens: 20, output_tokens: 8 },
    });
    const client = { messages: { create } };

    const adapter = anthropicAdapter({
      model: 'claude-sonnet-5',
      systemPrompt: 'Be concise.',
      client,
    });

    const result = await adapter('What is 2+2?', {
      case: { id: 'a', input: 'What is 2+2?' },
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5',
        system: 'Be concise.',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      }),
    );
    expect(result.output).toBe('part one. part two.');
    expect(result.cost).toEqual({ inputTokens: 20, outputTokens: 8 });
  });

  it('respects a custom maxTokens', async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'x' }] });
    const client = { messages: { create } };
    const adapter = anthropicAdapter({
      model: 'claude-sonnet-5',
      maxTokens: 256,
      client,
    });

    await adapter('x', { case: { id: 'a', input: 'x' } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 256 }));
  });

  it('ignores non-text content blocks when building the output', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'tool_use' }, { type: 'text', text: 'the real answer' }],
    });
    const client = { messages: { create } };
    const adapter = anthropicAdapter({ model: 'claude-sonnet-5', client });

    const result = await adapter('x', { case: { id: 'a', input: 'x' } });
    expect(result.output).toBe('the real answer');
  });

  it('throws a PromptProofError when no API key is available and no client is injected', async () => {
    const adapter = anthropicAdapter({ model: 'claude-sonnet-5' });
    await expect(adapter('x', { case: { id: 'a', input: 'x' } })).rejects.toThrow(
      PromptProofError,
    );
    await expect(adapter('x', { case: { id: 'a', input: 'x' } })).rejects.toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });

  it('lazily loads the "@anthropic-ai/sdk" package at most once per adapter instance', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    const adapter = anthropicAdapter({ model: 'claude-sonnet-5' });

    await adapter('one', { case: { id: 'a', input: 'one' } });
    await adapter('two', { case: { id: 'b', input: 'two' } });

    expect(AnthropicCtorSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledTimes(2);
  });
});
