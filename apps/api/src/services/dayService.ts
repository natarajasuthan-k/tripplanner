// Day saves and presence — backend-spec BR7, BR8, BR10; api-contract E10–E12.
// Callers resolve the day first (middleware `tripDay`), so 404 precedes 400 (api-contract §2).
import {
  isCompleted,
  PRESENCE_TTL_SECONDS,
  type Day,
  type DayConflictDetails,
} from '@tripplanner/shared';
import type { Db } from '../db/client';
import { AppError, notFound } from '../lib/errors';
import { findDayInTrip, updateDayText, type DayRow } from '../repositories/dayRepo';
import {
  activePresenceForTrip,
  removePresence,
  upsertPresence,
} from '../repositories/presenceRepo';
import type { TripRow } from '../repositories/tripRepo';
import { toDay } from './views';

export function assertNotCompleted(trip: TripRow): void {
  if (isCompleted(trip.toDate)) {
    throw new AppError('TRIP_COMPLETED', 'This trip has ended and is read-only.');
  }
}

async function withEditors(
  db: Db,
  trip: TripRow,
  row: DayRow,
  sessionId: string | null,
): Promise<Day> {
  const presence = await activePresenceForTrip(db, {
    tripId: trip.id,
    dayId: row.id,
    excludeSessionId: sessionId,
    ttlSeconds: PRESENCE_TTL_SECONDS,
  });
  return toDay(row, trip.fromDate, presence);
}

export async function saveDay(
  db: Db,
  trip: TripRow,
  day: DayRow,
  input: { text: string; version: number; editorName: string },
  sessionId: string | null,
): Promise<Day> {
  assertNotCompleted(trip);

  const updated = await updateDayText(db, { tripId: trip.id, dayId: day.id, ...input });
  if (updated) return withEditors(db, trip, updated, sessionId);

  const current = await findDayInTrip(db, trip.id, day.id);
  if (!current) throw notFound('Day not found');
  throw new AppError<DayConflictDetails>(
    'DAY_VERSION_CONFLICT',
    'Someone else saved this day while you were editing.',
    { current: await withEditors(db, trip, current, sessionId) },
  );
}

export async function heartbeat(
  db: Db,
  trip: TripRow,
  day: DayRow,
  input: { sessionId: string; editorName: string },
): Promise<void> {
  assertNotCompleted(trip);
  await upsertPresence(db, {
    dayId: day.id,
    sessionId: input.sessionId,
    displayName: input.editorName,
  });
}

export async function stopEditing(
  db: Db,
  trip: TripRow,
  day: DayRow,
  sessionId: string,
): Promise<void> {
  assertNotCompleted(trip);
  await removePresence(db, day.id, sessionId);
}
