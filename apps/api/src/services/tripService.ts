// Trip creation, view and deletion — backend-spec BR1–BR5, BR14, api-contract E4/E5/E7.
import {
  addDays,
  dayCountInclusive,
  normalizeTripName,
  PRESENCE_TTL_SECONDS,
  slugify,
  tripNameKey,
  type Role,
  type TripView,
} from '@tripplanner/shared';
import type { Db } from '../db/client';
import { AppError, validationError } from '../lib/errors';
import { randomToken, uuidv7 } from '../lib/ids';
import { isUniqueViolation } from '../lib/pgErrors';
import { hitCounter } from '../repositories/cacheRepo';
import { listDays } from '../repositories/dayRepo';
import { listPendingDeleteRequests } from '../repositories/deleteRequestRepo';
import { findDestination } from '../repositories/destinationRepo';
import { activePresenceForTrip } from '../repositories/presenceRepo';
import {
  deleteTrip as deleteTripRow,
  insertTripWithDays,
  nameKeyExists,
  takenSlugs,
  type TripRow,
} from '../repositories/tripRepo';
import { rateLimited } from '../middleware/rateLimit';
import { buildTripView } from './views';

const CREATE_LIMIT_PER_HOUR = 10;

export interface CreateTripInput {
  name: string;
  destinationId: string;
  fromDate: string;
  toDate: string;
}

const nameTaken = () =>
  new AppError('TRIP_NAME_TAKEN', 'That trip name is already taken. Please choose another.', {
    field: 'name',
  });

/** First free slug among base, base-2, base-3… (BR3). */
async function pickSlug(db: Db, name: string): Promise<string> {
  const base = slugify(name);
  const taken = await takenSlugs(db, base);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
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

  if (!(await findDestination(db, input.destinationId))) {
    throw validationError({ destinationId: ['Please choose a destination from the list'] });
  }
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
        },
        Array.from({ length: dayCount }, (_, i) => ({
          id: uuidv7(),
          tripId,
          position: i + 1,
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
