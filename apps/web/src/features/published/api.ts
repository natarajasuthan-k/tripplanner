// Public endpoints: directory, published trip, places, recovery (api-contract E3, E15–E17).
import {
  PAGE_LIMIT_DEFAULT,
  type PlacesResponse,
  type PublicTripResponse,
  type TripSummaryPage,
} from '@tripplanner/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../../lib/api';

export interface PublishedFilter {
  q?: string;
  destinationId?: string;
  excludeSlug?: string;
  limit?: number;
}

function query(filter: PublishedFilter, page: number) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(filter.limit ?? PAGE_LIMIT_DEFAULT),
  });
  if (filter.q) params.set('q', filter.q);
  if (filter.destinationId) params.set('destinationId', filter.destinationId);
  if (filter.excludeSlug) params.set('excludeSlug', filter.excludeSlug);
  return `/trips/published?${params}`;
}

export const fetchPublished = (filter: PublishedFilter, page = 1) =>
  apiFetch<TripSummaryPage>(query(filter, page));

/** One page — Home "Recently published", earlier trips for a destination (F4, F6). */
export function usePublishedTrips(filter: PublishedFilter, enabled = true) {
  return useQuery({
    queryKey: ['published', filter],
    queryFn: () => fetchPublished(filter),
    enabled,
    staleTime: 60_000,
  });
}

/** Explore page with "Load more" (frontend-spec §3.5). */
export function usePublishedInfinite(filter: PublishedFilter) {
  return useInfiniteQuery({
    queryKey: ['published', 'infinite', filter],
    queryFn: ({ pageParam }) => fetchPublished(filter, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 60_000,
  });
}

export function usePublishedTrip(slug: string) {
  return useQuery({
    queryKey: ['publishedTrip', slug],
    queryFn: () => apiFetch<PublicTripResponse>(`/trips/published/${encodeURIComponent(slug)}`),
    staleTime: 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
}

export function usePlaces(destinationId: string) {
  return useQuery({
    queryKey: ['places', destinationId],
    queryFn: () => apiFetch<PlacesResponse>(`/destinations/${destinationId}/places?limit=30`),
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });
}

export const recoverLinks = (email: string) =>
  apiFetch<{ message: string }>('/recover', { method: 'POST', body: { email } });
