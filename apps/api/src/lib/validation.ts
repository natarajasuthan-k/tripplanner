import type { Hook } from '@hono/zod-openapi';
import type { ZodError } from 'zod';
import { validationError, type FieldErrors } from './errors';

export function zodToFieldErrors(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/** `defaultHook` for OpenAPIHono: every failed request validation becomes VALIDATION_ERROR. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validationHook: Hook<any, any, any, any> = (result) => {
  if (!result.success) {
    throw validationError(zodToFieldErrors(result.error));
  }
};
