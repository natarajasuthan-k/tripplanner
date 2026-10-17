import { and, eq, gt, lt, ne } from 'drizzle-orm';
import type { Db } from '../db/client';
import { dayPresence, days } from '../db/schema';

export interface PresenceRow {
  dayId: string;
  displayName: string;
  lastSeenAt: Date;
}

export async function upsertPresence(
  db: Db,
  args: { dayId: string; sessionId: string; displayName: string },
): Promise<void> {
  const now = new Date();
  await db
    .insert(dayPresence)
    .values({ ...args, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [dayPresence.dayId, dayPresence.sessionId],
      set: { displayName: args.displayName, lastSeenAt: now },
    });
}

export async function removePresence(db: Db, dayId: string, sessionId: string): Promise<void> {
  await db
    .delete(dayPresence)
    .where(and(eq(dayPresence.dayId, dayId), eq(dayPresence.sessionId, sessionId)));
}

/** Editors seen within `ttlSeconds`, excluding the caller's own session (BR10). */
export async function activePresenceForTrip(
  db: Db,
  args: { tripId: string; excludeSessionId: string | null; ttlSeconds: number; dayId?: string },
): Promise<PresenceRow[]> {
  const since = new Date(Date.now() - args.ttlSeconds * 1000);
  const conditions = [eq(days.tripId, args.tripId), gt(dayPresence.lastSeenAt, since)];
  if (args.excludeSessionId) conditions.push(ne(dayPresence.sessionId, args.excludeSessionId));
  if (args.dayId) conditions.push(eq(dayPresence.dayId, args.dayId));
  return db
    .select({
      dayId: dayPresence.dayId,
      displayName: dayPresence.displayName,
      lastSeenAt: dayPresence.lastSeenAt,
    })
    .from(dayPresence)
    .innerJoin(days, eq(days.id, dayPresence.dayId))
    .where(and(...conditions))
    .orderBy(dayPresence.lastSeenAt);
}

/** Scheduled cleanup (backend-spec §10). */
export async function deleteStalePresence(db: Db, olderThanSeconds: number): Promise<void> {
  await db
    .delete(dayPresence)
    .where(lt(dayPresence.lastSeenAt, new Date(Date.now() - olderThanSeconds * 1000)));
}
