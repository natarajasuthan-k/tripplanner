import { eq, like, or } from 'drizzle-orm';
import type { Db } from '../db/client';
import { days, trips, tripSlugHistory } from '../db/schema';

export type TripRow = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type NewDay = typeof days.$inferInsert;
export type TokenRole = 'organiser' | 'editor' | 'viewer';

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

export async function nameKeyExists(db: Db, nameKey: string): Promise<boolean> {
  const rows = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.nameKey, nameKey))
    .limit(1);
  return rows.length > 0;
}

/** Live and historical slugs equal to `base` or `base-<n>` (BR3). */
export async function takenSlugs(db: Db, base: string): Promise<Set<string>> {
  const pattern = `${base}-%`;
  const [live, old] = await Promise.all([
    db
      .select({ slug: trips.slug })
      .from(trips)
      .where(or(eq(trips.slug, base), like(trips.slug, pattern))),
    db
      .select({ slug: tripSlugHistory.oldSlug })
      .from(tripSlugHistory)
      .where(or(eq(tripSlugHistory.oldSlug, base), like(tripSlugHistory.oldSlug, pattern))),
  ]);
  return new Set([...live, ...old].map((r) => r.slug));
}

export async function insertTripWithDays(db: Db, trip: NewTrip, dayRows: NewDay[]) {
  return db.transaction(async (tx) => {
    const [inserted] = await tx.insert(trips).values(trip).returning();
    await tx.insert(days).values(dayRows);
    return inserted!;
  });
}

export async function deleteTrip(db: Db, tripId: string): Promise<void> {
  await db.delete(trips).where(eq(trips.id, tripId));
}
