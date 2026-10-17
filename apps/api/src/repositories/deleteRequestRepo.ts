import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { deleteRequests } from '../db/schema';
import { uuidv7 } from '../lib/ids';

export type DeleteRequestRow = typeof deleteRequests.$inferSelect;

export async function insertDeleteRequest(
  db: Db,
  tripId: string,
  requestedByName: string,
): Promise<DeleteRequestRow> {
  const [row] = await db
    .insert(deleteRequests)
    .values({ id: uuidv7(), tripId, requestedByName })
    .returning();
  return row!;
}

export function listPendingDeleteRequests(db: Db, tripId: string): Promise<DeleteRequestRow[]> {
  return db
    .select()
    .from(deleteRequests)
    .where(and(eq(deleteRequests.tripId, tripId), eq(deleteRequests.status, 'pending')))
    .orderBy(desc(deleteRequests.createdAt), desc(deleteRequests.id));
}

/** Dismiss every pending request (QB8). Returns how many were dismissed. */
export async function dismissPendingDeleteRequests(db: Db, tripId: string): Promise<number> {
  const rows = await db
    .update(deleteRequests)
    .set({ status: 'dismissed', resolvedAt: new Date() })
    .where(and(eq(deleteRequests.tripId, tripId), eq(deleteRequests.status, 'pending')))
    .returning({ id: deleteRequests.id });
  return rows.length;
}
