import { ERROR_STATUS, type ApiErrorBody, type ErrorCode } from '@tripplanner/shared';

/** Throw from services/routes; the error handler maps it to the api-contract §2 shape. */
export class AppError<TDetails = unknown> extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: TDetails | null = null,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = ERROR_STATUS[code];
  }

  toBody(): ApiErrorBody<TDetails> {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

export const notFound = (message = 'Not found') => new AppError('NOT_FOUND', message);
export const forbidden = (message = "You don't have permission to do that") =>
  new AppError('FORBIDDEN', message);

export type FieldErrors = Record<string, string[]>;

export function validationError(fields: FieldErrors, message = 'Some fields are invalid') {
  return new AppError<{ fields: FieldErrors }>('VALIDATION_ERROR', message, { fields });
}
