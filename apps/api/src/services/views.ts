// Row → api-contract §3 shapes.
import {
  dateForPosition,
  dayCountInclusive,
  isCompleted,
  permissionsFor,
  type Access,
  type Day,
  type DeleteRequestView,
  type Destination,
  type Role,
  type TripLinks,
  type TripView,
} from '@tripplanner/shared';
import type { DayRow } from '../repositories/dayRepo';
import type { DeleteRequestRow } from '../repositories/deleteRequestRepo';
import type { DestinationRow } from '../repositories/destinationRepo';
import type { PresenceRow } from '../repositories/presenceRepo';
import type { TripRow } from '../repositories/tripRepo';

export function toDestination(row: DestinationRow): Destination {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    country: row.country,
    countryCode: row.countryCode,
    lat: row.lat,
    lon: row.lon,
  };
}

export function toDay(row: DayRow, fromDate: string, presence: PresenceRow[] = []): Day {
  return {
    id: row.id,
    position: row.position,
    date: dateForPosition(fromDate, row.position),
    text: row.text,
    version: row.version,
    updatedByName: row.updatedByName,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    editors: presence
      .filter((p) => p.dayId === row.id)
      .map((p) => ({ displayName: p.displayName, lastSeenAt: p.lastSeenAt.toISOString() })),
  };
}

export function toDeleteRequest(row: DeleteRequestRow): DeleteRequestView {
  return {
    id: row.id,
    requestedByName: row.requestedByName,
    createdAt: row.createdAt.toISOString(),
  };
}

export function accessFor(role: Role, trip: TripRow, now = new Date()): Access {
  return { role, permissions: permissionsFor(role, isCompleted(trip.toDate, now)) };
}

function linksFor(role: Role, trip: TripRow): TripLinks | null {
  if (role === 'organiser') {
    return {
      organiserToken: trip.organiserToken,
      editToken: trip.editToken,
      viewToken: trip.viewToken,
    };
  }
  if (role === 'editor') return { editToken: trip.editToken, viewToken: trip.viewToken };
  return null;
}

export function buildTripView(args: {
  trip: TripRow;
  role: Role;
  destination: DestinationRow;
  days: DayRow[];
  presence: PresenceRow[];
  pendingDeleteRequests: DeleteRequestRow[];
  now?: Date;
}): TripView {
  const { trip, role } = args;
  const completed = isCompleted(trip.toDate, args.now);
  // Presence is only meaningful to people who can edit an active trip (api-contract §3 Day).
  const showPresence = (role === 'organiser' || role === 'editor') && !completed;
  const presence = showPresence ? args.presence : [];
  const organiser = role === 'organiser';

  return {
    name: trip.name,
    slug: trip.slug,
    destination: toDestination(args.destination),
    fromDate: trip.fromDate,
    toDate: trip.toDate,
    dayCount: dayCountInclusive(trip.fromDate, trip.toDate),
    status: {
      isPublished: trip.isPublished,
      publishedAt: trip.isPublished ? (trip.publishedAt?.toISOString() ?? null) : null,
      isCompleted: completed,
    },
    version: trip.version,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
    days: args.days.map((d) => toDay(d, trip.fromDate, presence)),
    links: linksFor(role, trip),
    hasRecoveryEmail: organiser ? trip.organiserEmailHash !== null : null,
    pendingDeleteRequests: organiser ? args.pendingDeleteRequests.map(toDeleteRequest) : null,
  };
}
