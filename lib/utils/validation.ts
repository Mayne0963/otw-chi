/**
 * Validation utils placeholder. Step 1 will define core schemas.
 */

export type ValidationResult = {
  valid: boolean;
  errors?: string[];
};

export function validate(_schema: unknown, _data: unknown): ValidationResult {
  // TODO: schema-driven validation (zod, valibot, custom, etc.)
  return { valid: false, errors: ['Validation not implemented'] };
}
