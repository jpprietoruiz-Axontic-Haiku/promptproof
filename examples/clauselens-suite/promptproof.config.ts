import { defineConfig, defineSuite, jsonSchema, latencyUnder } from 'promptproof';

/**
 * Illustrative suite for ClauseLens, a contract-clause analysis assistant
 * (see https://github.com/jpprieto — a separate project). This is a
 * self-contained, generic stand-in for the real evaluation: it grades a
 * mock risk-classification adapter, not ClauseLens' actual model or
 * prompts, so the suite stays runnable without API keys or private code.
 *
 * Swap `adapter` for a real one (e.g. `openaiAdapter({...})` wrapping
 * ClauseLens' own pipeline) to turn this into a real regression gate.
 */
function classifyClauseRisk(clause: string): string {
  const normalized = clause.toLowerCase();

  const highRiskSignals = [
    'unlimited liability',
    'sole discretion',
    'perpetual',
    'no cap on damages',
  ];
  const mediumRiskSignals = ['automatic renewal', 'exclusive', 'non-compete'];

  if (highRiskSignals.some((signal) => normalized.includes(signal))) {
    return JSON.stringify({ riskLevel: 'high', flagged: true });
  }
  if (mediumRiskSignals.some((signal) => normalized.includes(signal))) {
    return JSON.stringify({ riskLevel: 'medium', flagged: true });
  }
  return JSON.stringify({ riskLevel: 'low', flagged: false });
}

const suite = defineSuite({
  name: 'clauselens-risk-classifier',
  description:
    'Evaluates a contract-clause risk classifier: does it flag risky clauses correctly?',
  cases: [
    {
      id: 'unlimited-liability',
      name: 'Unlimited liability clause',
      input:
        'Notwithstanding anything to the contrary, Vendor shall have unlimited liability for any breach of this Agreement.',
    },
    {
      id: 'auto-renewal',
      name: 'Automatic renewal clause',
      input:
        'This Agreement shall automatically renew for successive one-year terms unless either party provides 90 days notice.',
    },
    {
      id: 'mutual-confidentiality',
      name: 'Standard mutual confidentiality clause',
      input:
        "Each party agrees to keep the other party's Confidential Information confidential and use it solely to perform this Agreement.",
    },
    {
      id: 'sole-discretion-termination',
      name: 'Sole discretion termination clause',
      input:
        'Company may terminate this Agreement at any time, for any reason, in its sole discretion.',
    },
  ],
  graders: [
    jsonSchema({
      type: 'object',
      required: ['riskLevel', 'flagged'],
      properties: {
        riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
        flagged: { type: 'boolean' },
      },
    }),
    latencyUnder(200),
  ],
  thresholds: {
    passRate: 1,
    graders: {
      jsonSchema: { minPassRate: 1 },
    },
  },
});

export default defineConfig({
  suite,
  adapter: (input: string) => ({ output: classifyClauseRisk(input) }),
});
