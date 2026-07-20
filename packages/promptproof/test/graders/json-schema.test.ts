import { describe, expect, it } from 'vitest';
import { jsonSchema } from '../../src/graders/json-schema.js';
import type { GraderContext, SuiteCase } from '../../src/core/types.js';

function ctx(output: string): GraderContext {
  const suiteCase: SuiteCase = { id: 'c1', input: 'irrelevant' };
  return { case: suiteCase, output, latencyMs: 1 };
}

const schema = {
  type: 'object',
  required: ['refundApproved'],
  properties: {
    refundApproved: { type: 'boolean' },
  },
} as const;

describe('jsonSchema', () => {
  it('has the default name', () => {
    expect(jsonSchema(schema).name).toBe('jsonSchema');
  });

  it('passes when the output matches the schema', async () => {
    const result = await jsonSchema(schema).grade(ctx('{"refundApproved": true}'));
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails when the output is not valid JSON', async () => {
    const result = await jsonSchema(schema).grade(ctx('not json at all'));
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('not valid JSON');
  });

  it('fails when the JSON does not satisfy the schema, with ajv error details', async () => {
    const result = await jsonSchema(schema).grade(ctx('{"refundApproved": "yes"}'));
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toBeTruthy();
    expect(result.details?.['errors']).toBeDefined();
  });

  it('fails when a required field is missing', async () => {
    const result = await jsonSchema(schema).grade(ctx('{}'));
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('refundApproved');
  });
});
