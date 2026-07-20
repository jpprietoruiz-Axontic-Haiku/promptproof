import { describe, expect, it, vi } from 'vitest';
import { llmJudge } from '../../src/graders/llm-judge.js';
import type { Adapter, GraderContext, SuiteCase } from '../../src/core/types.js';

function ctx(output: string, expected?: string): GraderContext<unknown, string> {
  const suiteCase: SuiteCase<unknown, string> = {
    id: 'c1',
    input: 'What is the capital of France?',
    ...(expected !== undefined ? { expected } : {}),
  };
  return { case: suiteCase, output, latencyMs: 1 };
}

function fakeJudge(response: string): Adapter<string> {
  return vi.fn().mockResolvedValue({ output: response });
}

describe('llmJudge', () => {
  it('has the default name', () => {
    expect(llmJudge({ criteria: 'x', judge: fakeJudge('{}') }).name).toBe('llmJudge');
  });

  it('accepts a custom name', () => {
    expect(
      llmJudge({ criteria: 'x', judge: fakeJudge('{}'), name: 'faithfulness' }).name,
    ).toBe('faithfulness');
  });

  it('passes when the judge score meets the threshold', async () => {
    const judge = fakeJudge('{"score": 0.9, "reason": "Accurate and complete."}');
    const grader = llmJudge({ criteria: 'Must be factually correct.', judge });

    const result = await grader.grade(ctx('Paris', 'Paris'));

    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.9);
    expect(result.reason).toBe('Accurate and complete.');
  });

  it('fails when the judge score is below the threshold', async () => {
    const judge = fakeJudge('{"score": 0.3, "reason": "Missing key details."}');
    const grader = llmJudge({
      criteria: 'Must be factually correct.',
      judge,
      threshold: 0.7,
    });

    const result = await grader.grade(ctx('Lyon', 'Paris'));

    expect(result.pass).toBe(false);
    expect(result.score).toBe(0.3);
  });

  it('extracts JSON even when the judge wraps it in prose or markdown', async () => {
    const judge = fakeJudge(
      'Sure, here you go:\n```json\n{"score": 1, "reason": "Perfect."}\n```',
    );
    const grader = llmJudge({ criteria: 'x', judge });

    const result = await grader.grade(ctx('Paris'));
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('clamps out-of-range scores into [0, 1]', async () => {
    const judge = fakeJudge('{"score": 5}');
    const result = await llmJudge({ criteria: 'x', judge }).grade(ctx('Paris'));
    expect(result.score).toBe(1);
  });

  it('fails gracefully when the judge response has no JSON object', async () => {
    const judge = fakeJudge('I refuse to answer in JSON.');
    const result = await llmJudge({ criteria: 'x', judge }).grade(ctx('Paris'));
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('JSON object');
  });

  it('fails gracefully when the judge response has malformed JSON', async () => {
    const judge = fakeJudge('{"score": 0.5, "reason": "unterminated string}');
    const result = await llmJudge({ criteria: 'x', judge }).grade(ctx('Paris'));
    expect(result.pass).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('fails gracefully when the judge JSON has no numeric score', async () => {
    const judge = fakeJudge('{"reason": "looks fine"}');
    const result = await llmJudge({ criteria: 'x', judge }).grade(ctx('Paris'));
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('score');
  });

  it('fails gracefully when the judge adapter throws', async () => {
    const judge: Adapter<string> = vi.fn().mockRejectedValue(new Error('judge is down'));
    const result = await llmJudge({ criteria: 'x', judge }).grade(ctx('Paris'));
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('judge is down');
  });

  it('passes the case input, expected value, and output to the judge prompt', async () => {
    const judge = vi.fn().mockResolvedValue({ output: '{"score": 1}' });
    await llmJudge({ criteria: 'Be accurate.', judge }).grade(ctx('Paris', 'Paris'));

    const [prompt] = judge.mock.calls[0] as [string];
    expect(prompt).toContain('Be accurate.');
    expect(prompt).toContain('What is the capital of France?');
    expect(prompt).toContain('Paris');
  });
});
