import { and, asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { days } from '../db/schema';

export type DayRow = typeof days.$inferSelect;

export function listDays(db: Db, tripId: string): Promise<DayRow[]> {
  return db.select().from(days).where(eq(days.tripId, tripId)).orderBy(asc(days.position));
}

export async function findDayInTrip(db: Db, tripId: string, dayId: string) {
  const [day] = await db
    .select()
    .from(days)
    .where(and(eq(days.id, dayId), eq(days.tripId, tripId)))
    .limit(1);
  return day ?? null;
}

/** Optimistic-concurrency update (BR7). Returns null when `version` is stale. */
export async function updateDayText(
  db: Db,
  args: { tripId: string; dayId: string; version: number; text: string; editorName: string },
): Promise<DayRow | null> {
  const [updated] = await db
    .update(days)
    .set({
      text: args.text,
      version: sql`${days.version} + 1`,
      updatedByName: args.editorName,
      updatedAt: new Date(),
    })
    .where(
      and(eq(days.id, args.dayId), eq(days.tripId, args.tripId), eq(days.version, args.version)),
    )
    .returning();
  return updated ?? null;
}
