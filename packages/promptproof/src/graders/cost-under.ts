import type { Grader } from '../core/types.js';

export interface CostUnderOptions {
  /** Grader name, used in reports and threshold config. Defaults to `'costUnder'`. */
  readonly name?: string;
}

/**
 * Passes when the case's cost is at or below `maxUsd`. Requires the adapter
 * to report `cost.totalCostUsd` (the built-in adapters only do this when
 * given a `pricing` table) — a case with no cost data always fails, with a
 * reason explaining why.
 *
 * @example
 * ```ts
 * costUnder(0.01); // fail any case costing more than $0.01
 * ```
 */
export function costUnder(maxUsd: number, options: CostUnderOptions = {}): Grader {
  const name = options.name ?? 'costUnder';

  return {
    name,
    grade({ cost }) {
      if (cost?.totalCostUsd === undefined) {
        return {
          pass: false,
          reason:
            'No cost data was reported for this case. Pass a `pricing` table to the adapter to enable cost tracking.',
        };
      }

      const pass = cost.totalCostUsd <= maxUsd;
      return {
        pass,
        score: pass ? 1 : 0,
        ...(pass
          ? {}
          : {
              reason: `Cost $${cost.totalCostUsd.toFixed(6)} exceeds the $${maxUsd} limit.`,
            }),
      };
    },
  };
}
