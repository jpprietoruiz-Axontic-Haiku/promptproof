import type { Grader } from '../core/types.js';

export interface LatencyUnderOptions {
  /** Grader name, used in reports and threshold config. Defaults to `'latencyUnder'`. */
  readonly name?: string;
}

/**
 * Passes when the case's latency is at or below `maxMs`. Latency is either
 * reported by the adapter or measured by the runner around the adapter call.
 *
 * @example
 * ```ts
 * latencyUnder(2_000); // fail any case slower than 2s
 * ```
 */
export function latencyUnder(maxMs: number, options: LatencyUnderOptions = {}): Grader {
  const name = options.name ?? 'latencyUnder';

  return {
    name,
    grade({ latencyMs }) {
      const pass = latencyMs <= maxMs;
      return {
        pass,
        score: pass ? 1 : 0,
        ...(pass
          ? {}
          : {
              reason: `Latency ${latencyMs.toFixed(0)}ms exceeds the ${maxMs}ms limit.`,
            }),
      };
    },
  };
}
