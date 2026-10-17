// Thin fetch wrapper for the Trip Planner API (api-contract-spec). Feature hooks build on this.
import { API_VERSION_PREFIX, isApiErrorBody, type ErrorCode } from '@tripplanner/shared';
import { getSessionId } from './session';

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? API_VERSION_PREFIX;

export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

export class ApiError<TDetails = unknown> extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
    message: string,
    readonly details: TDetails | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/** Sends the request (adds X-Session-Id and JSON body); throws NETWORK_ERROR if unreachable. */
export async function apiFetchRaw(path: string, init: ApiRequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('X-Session-Id', getSessionId());
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server. Check your connection.");
  }
}

/** Converts a non-2xx response into an ApiError using the standard error body. */
export async function toApiError(res: Response): Promise<ApiError> {
  const data: unknown = await res.json().catch(() => null);
  if (isApiErrorBody(data)) {
    return new ApiError(res.status, data.error.code, data.error.message, data.error.details);
  }
  return new ApiError(res.status, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.');
}

export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const res = await apiFetchRaw(path, init);
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

export function isApiError(err: unknown, code?: ClientErrorCode): err is ApiError {
  return err instanceof ApiError && (code === undefined || err.code === code);
}
