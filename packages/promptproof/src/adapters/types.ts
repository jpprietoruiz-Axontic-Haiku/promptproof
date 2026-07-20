export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** Case input accepted by the built-in provider adapters: a raw prompt or a full conversation. */
export type PromptInput = string | readonly ChatMessage[];

/**
 * Normalizes a {@link PromptInput} into a message list, prepending
 * `systemPrompt` unless the input already includes a system message.
 */
export function toMessages(input: PromptInput, systemPrompt?: string): ChatMessage[] {
  const messages: ChatMessage[] =
    typeof input === 'string' ? [{ role: 'user', content: input }] : [...input];

  if (!systemPrompt || messages.some((message) => message.role === 'system')) {
    return messages;
  }

  return [{ role: 'system', content: systemPrompt }, ...messages];
}
