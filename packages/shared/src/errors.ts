// Error codes and HTTP statuses — api-contract-spec §2.

export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TRIP_NAME_TAKEN: 409,
  TRIP_VERSION_CONFLICT: 409,
  DAY_VERSION_CONFLICT: 409,
  DAYS_WOULD_BE_REMOVED: 409,
  TRIP_COMPLETED: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  PROVIDER_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface ApiErrorBody<TDetails = unknown> {
  error: {
    code: ErrorCode;
    message: string;
    details: TDetails | null;
  };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { code: string }).code in ERROR_STATUS
  );
}
