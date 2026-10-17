import { and, asc, count, desc, eq, gt, ilike, ne, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { days, destinations, trips, tripSlugHistory } from '../db/schema';

export type TripRow = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type NewDay = typeof days.$inferInsert;
export type TokenRole = 'organiser' | 'editor' | 'viewer';
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** One indexed lookup across all three code columns (backend-spec §5). */
export async function findTripByToken(
  db: Db,
  token: string,
): Promise<{ trip: TripRow; role: TokenRole } | null> {
  const [trip] = await db
    .select()
    .from(trips)
    .where(
      or(eq(trips.organiserToken, token), eq(trips.editToken, token), eq(trips.viewToken, token)),
    )
    .limit(1);
  if (!trip) return null;
  const role: TokenRole =
    trip.organiserToken === token ? 'organiser' : trip.editToken === token ? 'editor' : 'viewer';
  return { trip, role };
}

/** True if another trip (not `exceptId`) already uses this name key (BR2). */
export async function nameKeyExists(db: Db, nameKey: string, exceptId?: string): Promise<boolean> {
  const where = exceptId
    ? and(eq(trips.nameKey, nameKey), ne(trips.id, exceptId))
    : eq(trips.nameKey, nameKey);
  const rows = await db.select({ id: trips.id }).from(trips).where(where).limit(1);
  return rows.length > 0;
}

/**
 * Live slugs equal to `base` or `base-<n>`, excluding `exceptId` (BR3).
 * Old slugs in trip_slug_history are not counted: live slugs take priority (QB9).
 */
export async function takenSlugs(db: Db, base: string, exceptId?: string): Promise<Set<string>> {
  const match = or(eq(trips.slug, base), sql`${trips.slug} like ${`${base}-%`}`);
  const rows = await db
    .select({ slug: trips.slug })
    .from(trips)
    .where(exceptId ? and(match, ne(trips.id, exceptId)) : match);
  return new Set(rows.map((r) => r.slug));
}

/** A new live slug evicts any old-slug redirect with the same value (QB9). */
async function claimSlug(tx: Tx | Db, slug: string) {
  await tx.delete(tripSlugHistory).where(eq(tripSlugHistory.oldSlug, slug));
}

export async function insertTripWithDays(db: Db, trip: NewTrip, dayRows: NewDay[]) {
  return db.transaction(async (tx) => {
    await claimSlug(tx, trip.slug);
    const [inserted] = await tx.insert(trips).values(trip).returning();
    await tx.insert(days).values(dayRows);
    return inserted!;
  });
}

export async function deleteTrip(db: Db, tripId: string): Promise<void> {
  await db.delete(trips).where(eq(trips.id, tripId));
}

export interface TripChanges {
  name: string;
  nameKey: string;
  slug: string;
  destinationId: string;
  fromDate: string;
  toDate: string;
}

/**
 * Apply an edit atomically with an optimistic version check (BR5, BR7 pattern).
 * Returns null when `expectedVersion` is stale.
 */
export async function updateTripAndDays(
  db: Db,
  trip: TripRow,
  expectedVersion: number,
  changes: TripChanges,
  oldDayCount: number,
  newDayCount: number,
  newDayIds: () => string,
): Promise<TripRow | null> {
  try {
    return await updateInTx(
      db,
      trip,
      expectedVersion,
      changes,
      oldDayCount,
      newDayCount,
      newDayIds,
    );
  } catch (err) {
    if (err instanceof StaleVersion) return null;
    throw err;
  }
}

class StaleVersion extends Error {}

function updateInTx(
  db: Db,
  trip: TripRow,
  expectedVersion: number,
  changes: TripChanges,
  oldDayCount: number,
  newDayCount: number,
  newDayIds: () => string,
): Promise<TripRow> {
  return db.transaction(async (tx) => {
    if (changes.slug !== trip.slug) {
      await claimSlug(tx, changes.slug);
      await tx
        .insert(tripSlugHistory)
        .values({ oldSlug: trip.slug, tripId: trip.id })
        .onConflictDoUpdate({ target: tripSlugHistory.oldSlug, set: { tripId: trip.id } });
    }
    const [updated] = await tx
      .update(trips)
      .set({ ...changes, version: sql`${trips.version} + 1`, updatedAt: new Date() })
      .where(and(eq(trips.id, trip.id), eq(trips.version, expectedVersion)))
      .returning();
    if (!updated) throw new StaleVersion(); // rolls the transaction back
    if (newDayCount < oldDayCount) {
      await tx.delete(days).where(and(eq(days.tripId, trip.id), gt(days.position, newDayCount)));
    } else if (newDayCount > oldDayCount) {
      await tx.insert(days).values(
        Array.from({ length: newDayCount - oldDayCount }, (_, i) => ({
          id: newDayIds(),
          tripId: trip.id,
          position: oldDayCount + i + 1,
        })),
      );
    }
    return updated;
  });
}

export async function setPublished(db: Db, tripId: string, published: boolean): Promise<TripRow> {
  const [row] = await db
    .update(trips)
    .set(
      published
        ? { isPublished: true, publishedAt: new Date(), updatedAt: new Date() }
        : { isPublished: false, updatedAt: new Date() },
    )
    .where(eq(trips.id, tripId))
    .returning();
  return row!;
}

/** A published trip by its current slug or an old one (BR3, E16). */
export async function findPublishedBySlug(db: Db, slug: string): Promise<TripRow | null> {
  const [live] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.slug, slug), eq(trips.isPublished, true)))
    .limit(1);
  if (live) return live;
  const [old] = await db
    .select({ trip: trips })
    .from(tripSlugHistory)
    .innerJoin(trips, eq(trips.id, tripSlugHistory.tripId))
    .where(and(eq(tripSlugHistory.oldSlug, slug), eq(trips.isPublished, true)))
    .limit(1);
  return old?.trip ?? null;
}

export interface PublishedFilter {
  q?: string;
  destinationId?: string;
  excludeSlug?: string;
  page: number;
  limit: number;
}

/** Published trips, newest first (E15, BR15). */
export async function listPublished(db: Db, filter: PublishedFilter) {
  const conditions: SQL[] = [eq(trips.isPublished, true)];
  if (filter.destinationId) conditions.push(eq(trips.destinationId, filter.destinationId));
  if (filter.excludeSlug) conditions.push(ne(trips.slug, filter.excludeSlug));
  if (filter.q) {
    // Escape LIKE wildcards so user input matches literally (backslash is Postgres' default escape).
    const literal = filter.q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    const pattern = `%${literal}%`;
    conditions.push(or(ilike(trips.name, pattern), ilike(destinations.name, pattern))!);
  }
  const where = and(...conditions);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({ trip: trips, destination: destinations })
      .from(trips)
      .innerJoin(destinations, eq(destinations.id, trips.destinationId))
      .where(where)
      .orderBy(desc(trips.publishedAt), asc(trips.id))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit),
    db
      .select({ total: count() })
      .from(trips)
      .innerJoin(destinations, eq(destinations.id, trips.destinationId))
      .where(where),
  ]);
  return { rows, total: totalRow?.total ?? 0 };
}

export function findTripsByEmailHash(db: Db, emailHash: string): Promise<TripRow[]> {
  return db
    .select()
    .from(trips)
    .where(eq(trips.organiserEmailHash, emailHash))
    .orderBy(asc(trips.fromDate));
}
