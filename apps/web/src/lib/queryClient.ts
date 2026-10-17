import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

/** Reads retry twice except for client errors; mutations never auto-retry (frontend-spec §9). */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
