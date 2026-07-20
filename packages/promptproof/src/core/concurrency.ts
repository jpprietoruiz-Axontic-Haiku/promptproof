/**
 * Builds a tiny concurrency limiter: `run(fn)` queues `fn` and resolves once
 * it has actually started, never letting more than `concurrency` functions
 * be in flight at once.
 *
 * Kept in-house (no `p-limit` dependency) to keep the published package's
 * runtime dependency count at zero.
 */
export function createLimiter(
  concurrency: number,
): <T>(fn: () => Promise<T>) => Promise<T> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError(`concurrency must be a positive integer, got ${concurrency}.`);
  }

  let active = 0;
  const queue: Array<() => void> = [];

  const dequeueNext = (): void => {
    if (active >= concurrency) return;
    const startNext = queue.shift();
    if (!startNext) return;
    active++;
    startNext();
  };

  return async function limited<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      queue.push(resolve);
      dequeueNext();
    });

    try {
      return await fn();
    } finally {
      active--;
      dequeueNext();
    }
  };
}
