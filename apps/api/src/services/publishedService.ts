// Publishing and the public directory — backend-spec BR15, BR3; api-contract E8, E9, E15, E16.
import {
  dayCountInclusive,
  isCompleted,
  type PublicTripResponse,
  type TripStatus,
  type TripSummaryPage,
} from '@tripplanner/shared';
import type { Db } from '../db/client';
import { notFound } from '../lib/errors';
import { listDays } from '../repositories/dayRepo';
import type { DestinationRow } from '../repositories/destinationRepo';
import { findDestination } from '../repositories/destinationRepo';
import {
  findPublishedBySlug,
  listPublished,
  setPublished,
  type PublishedFilter,
  type TripRow,
} from '../repositories/tripRepo';
import { accessFor, toDay, toDestination } from './views';

export function statusOf(trip: TripRow, now = new Date()): TripStatus {
  return {
    isPublished: trip.isPublished,
    publishedAt: trip.isPublished ? (trip.publishedAt?.toISOString() ?? null) : null,
    isCompleted: isCompleted(trip.toDate, now),
  };
}

export async function publish(db: Db, trip: TripRow, published: boolean): Promise<TripStatus> {
  // Idempotent: re-publishing an already published trip keeps its original publishedAt.
  if (trip.isPublished === published) return statusOf(trip);
  return statusOf(await setPublished(db, trip.id, published));
}

function toSummary(trip: TripRow, destination: DestinationRow, now = new Date()) {
  return {
    name: trip.name,
    slug: trip.slug,
    destination: toDestination(destination),
    fromDate: trip.fromDate,
    toDate: trip.toDate,
    dayCount: dayCountInclusive(trip.fromDate, trip.toDate),
    isCompleted: isCompleted(trip.toDate, now),
    publishedAt: trip.publishedAt?.toISOString() ?? null,
  };
}

export async function listPublishedTrips(
  db: Db,
  filter: PublishedFilter,
): Promise<TripSummaryPage> {
  const { rows, total } = await listPublished(db, filter);
  return {
    items: rows.map((r) => toSummary(r.trip, r.destination)),
    page: filter.page,
    limit: filter.limit,
    total,
    hasMore: filter.page * filter.limit < total,
  };
}

export async function getPublishedTrip(db: Db, slug: string): Promise<PublicTripResponse> {
  const trip = await findPublishedBySlug(db, slug);
  if (!trip) throw notFound('Trip not found');
  const [destination, days] = await Promise.all([
    findDestination(db, trip.destinationId),
    listDays(db, trip.id),
  ]);
  return {
    trip: {
      name: trip.name,
      slug,
      canonicalSlug: trip.slug,
      destination: toDestination(destination!),
      fromDate: trip.fromDate,
      toDate: trip.toDate,
      dayCount: dayCountInclusive(trip.fromDate, trip.toDate),
      status: statusOf(trip),
      days: days.map((d) => toDay(d, trip.fromDate)),
    },
    access: accessFor('public', trip),
  };
}
