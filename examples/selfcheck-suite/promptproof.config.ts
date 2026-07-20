import { defineConfig, defineSuite, jsonSchema, latencyUnder } from 'promptproof';

/**
 * Deterministic, zero-network "system under test": a tiny rule-based intent
 * classifier. This suite exists to prove the promptproof CLI / GitHub Action
 * pipeline end to end — in CI, with no API keys — not to evaluate a real
 * model. See `examples/clauselens-suite` for a suite that evaluates a real
 * LLM app.
 */
function classify(message: string): string {
  const normalized = message.toLowerCase();

  if (/\b(refund|return|money back)\b/.test(normalized)) {
    return JSON.stringify({ intent: 'refund_request' });
  }
  if (/\b(hi|hello|hey)\b/.test(normalized)) {
    return JSON.stringify({ intent: 'greeting' });
  }
  return JSON.stringify({ intent: 'unknown' });
}

const suite = defineSuite({
  name: 'selfcheck-intent-classifier',
  description:
    'Deterministic demo suite — proves the promptproof pipeline end to end without API keys.',
  cases: [
    { id: 'greeting', input: 'Hello there!' },
    { id: 'refund', input: 'I want a refund please' },
    { id: 'unrelated', input: 'What is the weather today?' },
  ],
  graders: [
    jsonSchema({
      type: 'object',
      required: ['intent'],
      properties: {
        intent: { type: 'string', enum: ['greeting', 'refund_request', 'unknown'] },
      },
    }),
    latencyUnder(50),
  ],
  thresholds: { passRate: 1 },
});

export default defineConfig({
  suite,
  adapter: (input: string) => ({ output: classify(input) }),
});
