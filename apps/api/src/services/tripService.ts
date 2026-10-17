// Trip creation, edit, view and deletion — backend-spec BR1–BR6, BR13, BR14;
// api-contract E4–E7.
import {
  addDays,
  dateForPosition,
  dayCountInclusive,
  normalizeTripName,
  PRESENCE_TTL_SECONDS,
  slugify,
  tripNameKey,
  validateDateRange,
  type DaysWouldBeRemovedDetails,
  type Role,
  type TripView,
} from '@tripplanner/shared';
import type { Db } from '../db/client';
import { AppError, notFound, validationError, type FieldErrors } from '../lib/errors';
import { randomToken, uuidv7 } from '../lib/ids';
import { isUniqueViolation } from '../lib/pgErrors';
import { rateLimited } from '../middleware/rateLimit';
import { hitCounter } from '../repositories/cacheRepo';
import { listDays } from '../repositories/dayRepo';
import { listPendingDeleteRequests } from '../repositories/deleteRequestRepo';
import { findDestination } from '../repositories/destinationRepo';
import { activePresenceForTrip } from '../repositories/presenceRepo';
import {
  deleteTrip as deleteTripRow,
  findPublishedBySlug,
  insertTripWithDays,
  nameKeyExists,
  takenSlugs,
  updateTripAndDays,
  type TripRow,
} from '../repositories/tripRepo';
import { assertNotCompleted } from './dayService';
import { buildTripView } from './views';

const CREATE_LIMIT_PER_HOUR = 10;
const PREVIEW_CHARS = 120;

export interface CreateTripInput {
  name: string;
  destinationId: string;
  fromDate: string;
  toDate: string;
  /** HMAC of the organiser email (BR11); the address itself never reaches the service. */
  organiserEmailHash?: string | null;
  copyFromSlug?: string | null;
}

export interface UpdateTripInput {
  version: number;
  name?: string;
  destinationId?: string;
  fromDate?: string;
  toDate?: string;
  confirmRemoveDays: boolean;
}

const nameTaken = () =>
  new AppError('TRIP_NAME_TAKEN', 'That trip name is already taken. Please choose another.', {
    field: 'name',
  });

/** First free live slug among base, base-2, base-3… (BR3). */
async function pickSlug(db: Db, name: string, exceptId?: string): Promise<string> {
  const base = slugify(name);
  const taken = await takenSlugs(db, base, exceptId);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function assertDestination(exists: boolean) {
  if (!exists) {
    throw validationError({ destinationId: ['Please choose a destination from the list'] });
  }
}

export async function createTrip(
  db: Db,
  input: CreateTripInput,
  clientIp: string,
): Promise<TripRow> {
  const limit = await hitCounter(db, `create:${clientIp}`, 3600);
  if (limit.count > CREATE_LIMIT_PER_HOUR) throw rateLimited(limit.resetInSeconds);

  const name = normalizeTripName(input.name);
  const nameKey = tripNameKey(name);

  // Copying a plan (BR13): the source must be published.
  let sourceTexts: string[] = [];
  let copiedFromTripId: string | null = null;
  if (input.copyFromSlug) {
    const source = await findPublishedBySlug(db, input.copyFromSlug);
    if (!source) throw notFound('The trip to copy was not found or is no longer published.');
    sourceTexts = (await listDays(db, source.id)).map((d) => d.text);
    copiedFromTripId = source.id;
  }

  assertDestination(!!(await findDestination(db, input.destinationId)));
  if (await nameKeyExists(db, nameKey)) throw nameTaken();

  const dayCount = dayCountInclusive(input.fromDate, input.toDate);

  // Retry if a concurrent insert takes the same slug between pick and insert.
  for (let attempt = 0; attempt < 3; attempt++) {
    const tripId = uuidv7();
    try {
      return await insertTripWithDays(
        db,
        {
          id: tripId,
          name,
          nameKey,
          slug: await pickSlug(db, name),
          destinationId: input.destinationId,
          fromDate: input.fromDate,
          toDate: addDays(input.fromDate, dayCount - 1),
          organiserToken: randomToken(),
          editToken: randomToken(),
          viewToken: randomToken(),
          organiserEmailHash: input.organiserEmailHash ?? null,
          copiedFromTripId,
        },
        Array.from({ length: dayCount }, (_, i) => ({
          id: uuidv7(),
          tripId,
          position: i + 1,
          text: sourceTexts[i] ?? '',
        })),
      );
    } catch (err) {
      if (isUniqueViolation(err, 'trips_name_key_uq')) throw nameTaken();
      if (isUniqueViolation(err, 'trips_slug_uq') && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error('unreachable');
}

/** E6 — edit name, destination and/or dates (BR2–BR6, AC10.1–10.4). */
export async function updateTrip(
  db: Db,
  trip: TripRow,
  input: UpdateTripInput,
  now: Date = new Date(),
): Promise<TripRow> {
  assertNotCompleted(trip);

  const conflict = async () =>
    new AppError('TRIP_VERSION_CONFLICT', 'This trip was changed by someone else. Please review.', {
      current: await getTripView(db, trip, 'organiser', null),
    });
  if (input.version !== trip.version) throw await conflict();

  const name = input.name !== undefined ? normalizeTripName(input.name) : trip.name;
  const nameKey = tripNameKey(name);
  if (nameKey !== trip.nameKey && (await nameKeyExists(db, nameKey, trip.id))) throw nameTaken();

  const destinationId = input.destinationId ?? trip.destinationId;
  if (destinationId !== trip.destinationId) {
    assertDestination(!!(await findDestination(db, destinationId)));
  }

  const fromDate = input.fromDate ?? trip.fromDate;
  const toDate = input.toDate ?? trip.toDate;
  const issues = validateDateRange({ fromDate, toDate }, now, {
    allowPastFrom: fromDate === trip.fromDate,
  });
  if (issues.length > 0) {
    const fields: FieldErrors = {};
    for (const i of issues) (fields[i.field] ??= []).push(i.message);
    throw validationError(fields);
  }

  const oldCount = dayCountInclusive(trip.fromDate, trip.toDate);
  const newCount = dayCountInclusive(fromDate, toDate);

  // BR6: removing days that have text needs explicit confirmation.
  if (newCount < oldCount && !input.confirmRemoveDays) {
    const removed = (await listDays(db, trip.id))
      .filter((d) => d.position > newCount && d.text.trim() !== '')
      .map((d) => ({
        position: d.position,
        date: dateForPosition(trip.fromDate, d.position),
        textPreview: d.text.slice(0, PREVIEW_CHARS),
      }));
    if (removed.length > 0) {
      throw new AppError<DaysWouldBeRemovedDetails>(
        'DAYS_WOULD_BE_REMOVED',
        `${removed.length} day${removed.length === 1 ? '' : 's'} with plans would be removed.`,
        { removedDays: removed },
      );
    }
  }

  const slug = name === trip.name ? trip.slug : await pickSlug(db, name, trip.id);
  try {
    const updated = await updateTripAndDays(
      db,
      trip,
      input.version,
      { name, nameKey, slug, destinationId, fromDate, toDate },
      oldCount,
      newCount,
      uuidv7,
    );
    if (!updated) throw await conflict();
    return updated;
  } catch (err) {
    if (isUniqueViolation(err, 'trips_name_key_uq')) throw nameTaken();
    throw err;
  }
}

export async function getTripView(
  db: Db,
  trip: TripRow,
  role: Role,
  sessionId: string | null,
): Promise<TripView> {
  const [destination, days, presence, pending] = await Promise.all([
    findDestination(db, trip.destinationId),
    listDays(db, trip.id),
    activePresenceForTrip(db, {
      tripId: trip.id,
      excludeSessionId: sessionId,
      ttlSeconds: PRESENCE_TTL_SECONDS,
    }),
    role === 'organiser' ? listPendingDeleteRequests(db, trip.id) : Promise.resolve([]),
  ]);
  return buildTripView({
    trip,
    role,
    destination: destination!,
    days,
    presence,
    pendingDeleteRequests: pending,
  });
}

export async function deleteTrip(db: Db, trip: TripRow): Promise<void> {
  await deleteTripRow(db, trip.id);
}
