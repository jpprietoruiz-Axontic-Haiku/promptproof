/**
 * Base error type for all errors thrown by PromptProof.
 *
 * Catching this (instead of generic `Error`) lets consumers distinguish
 * configuration/usage mistakes raised by the library from errors thrown by
 * their own adapters or graders.
 */
export class PromptProofError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PromptProofError';
  }
}
