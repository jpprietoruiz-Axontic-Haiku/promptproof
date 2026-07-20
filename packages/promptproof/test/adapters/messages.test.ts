import { describe, expect, it } from 'vitest';
import { toMessages } from '../../src/adapters/types.js';

describe('toMessages', () => {
  it('wraps a plain string as a single user message', () => {
    expect(toMessages('hello')).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('prepends the system prompt when none is present', () => {
    expect(toMessages('hello', 'be nice')).toEqual([
      { role: 'system', content: 'be nice' },
      { role: 'user', content: 'hello' },
    ]);
  });

  it('leaves an existing system message untouched', () => {
    const input = [
      { role: 'system' as const, content: 'original' },
      { role: 'user' as const, content: 'hi' },
    ];
    expect(toMessages(input, 'override')).toEqual(input);
  });

  it('passes a full conversation through unchanged when there is no systemPrompt', () => {
    const input = [
      { role: 'user' as const, content: 'hi' },
      { role: 'assistant' as const, content: 'hello!' },
    ];
    expect(toMessages(input)).toEqual(input);
  });
});
