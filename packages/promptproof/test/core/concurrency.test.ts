import { describe, expect, it } from 'vitest';
import { createLimiter } from '../../src/core/concurrency.js';

describe('createLimiter', () => {
  it('rejects a non-positive concurrency', () => {
    expect(() => createLimiter(0)).toThrow(RangeError);
    expect(() => createLimiter(-1)).toThrow(RangeError);
  });

  it('runs all tasks and returns their results in order', async () => {
    const limiter = createLimiter(3);
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => limiter(() => Promise.resolve(n * 2))),
    );
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('never exceeds the configured concurrency', async () => {
    const limiter = createLimiter(2);
    let active = 0;
    let maxActive = 0;

    const task = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    };

    await Promise.all(Array.from({ length: 8 }, () => limiter(task)));
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('propagates a task rejection without blocking the queue', async () => {
    const limiter = createLimiter(1);
    const failing = limiter(() => Promise.reject(new Error('nope')));
    const succeeding = limiter(() => Promise.resolve('ok'));

    await expect(failing).rejects.toThrow('nope');
    await expect(succeeding).resolves.toBe('ok');
  });
});
