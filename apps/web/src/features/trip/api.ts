// Trip endpoints (api-contract E2, E4, E5, E7, E10–E14) and the polling query.
import {
  TRIP_POLL_SECONDS,
  type CreateTripRequest,
  type CreateTripResponse,
  type Day,
  type DeleteRequestView,
  type DestinationSearchResponse,
  type TripResponse,
} from '@tripplanner/shared';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchRaw, ApiError, toApiError } from '../../lib/api';
import { getSessionId } from '../../lib/session';

export const tripKey = (token: string) => ['trip', token] as const;

// ---- E5 with conditional GET (QA2) ------------------------------------------------

const etags = new Map<string, string>();

export async function fetchTrip(
  token: string,
  previous: TripResponse | undefined,
): Promise<TripResponse> {
  const etag = previous ? etags.get(token) : undefined;
  const res = await apiFetchRaw(`/trips/${encodeURIComponent(token)}`, {
    headers: etag ? { 'If-None-Match': etag } : undefined,
  });
  if (res.status === 304 && previous) return previous;
  if (!res.ok) {
    etags.delete(token);
    throw await toApiError(res);
  }
  const next = res.headers.get('ETag');
  if (next) etags.set(token, next);
  return (await res.json()) as TripResponse;
}

/** Polls every 10s while the tab is visible; stops on 404 (deleted / bad link). */
export function useTripQuery(token: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: tripKey(token),
    queryFn: () => fetchTrip(token, queryClient.getQueryData<TripResponse>(tripKey(token))),
    refetchInterval: (query) =>
      query.state.error instanceof ApiError && query.state.error.status === 404
        ? false
        : TRIP_POLL_SECONDS * 1000,
    refetchIntervalInBackground: false,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
}

/** Replace one day inside the cached trip after a save (frontend-spec §5). */
export function setCachedDay(queryClient: QueryClient, token: string, day: Day) {
  queryClient.setQueryData<TripResponse>(tripKey(token), (prev) =>
    prev
      ? {
          ...prev,
          trip: {
            ...prev.trip,
            days: prev.trip.days.map((d) =>
              d.id === day.id
                ? { ...day, editors: day.editors.length ? day.editors : d.editors }
                : d,
            ),
          },
        }
      : prev,
  );
  etags.delete(token); // cached body no longer matches the server's ETag
}

// ---- Mutations ------------------------------------------------------------------------

const t = (token: string) => `/trips/${encodeURIComponent(token)}`;

export const createTrip = (body: CreateTripRequest) =>
  apiFetch<CreateTripResponse>('/trips', { method: 'POST', body });

export const saveDay = (
  token: string,
  dayId: string,
  body: { text: string; version: number; editorName: string },
) => apiFetch<{ day: Day }>(`${t(token)}/days/${dayId}`, { method: 'PUT', body });

export const sendPresence = (token: string, dayId: string, editorName: string) =>
  apiFetch<void>(`${t(token)}/days/${dayId}/presence`, {
    method: 'PUT',
    body: { sessionId: getSessionId(), editorName },
  });

export const clearPresence = (token: string, dayId: string) =>
  apiFetch<void>(`${t(token)}/days/${dayId}/presence/${getSessionId()}`, { method: 'DELETE' });

export const deleteTrip = (token: string) => apiFetch<void>(t(token), { method: 'DELETE' });

export const requestDeletion = (token: string, requestedByName: string) =>
  apiFetch<{ deleteRequest: DeleteRequestView }>(`${t(token)}/delete-requests`, {
    method: 'POST',
    body: { requestedByName },
  });

export const dismissDeleteRequests = (token: string) =>
  apiFetch<{ dismissedCount: number }>(`${t(token)}/delete-requests/dismiss`, { method: 'POST' });

export const searchDestinations = (q: string, signal?: AbortSignal) =>
  apiFetch<DestinationSearchResponse>(`/destinations/search?q=${encodeURIComponent(q)}&limit=6`, {
    signal,
  });
