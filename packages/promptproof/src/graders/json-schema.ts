import Ajv, { type Schema } from 'ajv';
import type { Grader } from '../core/types.js';

export interface JsonSchemaOptions {
  /** Grader name, used in reports and threshold config. Defaults to `'jsonSchema'`. */
  readonly name?: string;
}

/**
 * Parses the output as JSON and validates it against a JSON Schema (via ajv).
 * Fails with a clear reason both when the output isn't valid JSON and when
 * it is valid JSON that doesn't satisfy the schema.
 *
 * @example
 * ```ts
 * jsonSchema({
 *   type: 'object',
 *   required: ['refundApproved'],
 *   properties: { refundApproved: { type: 'boolean' } },
 * });
 * ```
 */
export function jsonSchema(
  schema: Schema,
  options: JsonSchemaOptions = {},
): Grader<unknown, unknown> {
  const name = options.name ?? 'jsonSchema';
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  return {
    name,
    grade({ output }) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(output);
      } catch (error) {
        return {
          pass: false,
          reason: `Output is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      const pass = validate(parsed) === true;
      if (pass) {
        return { pass: true, score: 1 };
      }

      return {
        pass: false,
        score: 0,
        reason: ajv.errorsText(validate.errors, { separator: '; ' }),
        details: { errors: validate.errors ?? [] },
      };
    },
  };
}
