import { eq, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { providerCache, rateCounters } from '../db/schema';

// ---- provider_cache (backend-spec §3.6) ------------------------------------

export async function getCached<T>(
  db: Db,
  key: string,
): Promise<{ payload: T; fresh: boolean } | null> {
  const [row] = await db
    .select()
    .from(providerCache)
    .where(eq(providerCache.cacheKey, key))
    .limit(1);
  if (!row) return null;
  return { payload: row.payload as T, fresh: row.expiresAt.getTime() > Date.now() };
}

export async function putCached(
  db: Db,
  key: string,
  payload: unknown,
  ttlSeconds: number,
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  await db
    .insert(providerCache)
    .values({ cacheKey: key, payload, fetchedAt: now, expiresAt })
    .onConflictDoUpdate({
      target: providerCache.cacheKey,
      set: { payload, fetchedAt: now, expiresAt },
    });
}

// ---- rate_counters (backend-spec §3.8) -------------------------------------

/**
 * Increment a fixed-window counter and return the new count plus seconds until the window resets.
 */
export async function hitCounter(
  db: Db,
  name: string,
  windowSeconds: number,
): Promise<{ count: number; resetInSeconds: number }> {
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);
  const [row] = await db
    .insert(rateCounters)
    .values({ bucketKey: `${name}:${windowStart}`, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: rateCounters.bucketKey,
      set: { count: sql`${rateCounters.count} + 1` },
    })
    .returning({ count: rateCounters.count });
  return {
    count: row!.count,
    resetInSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)),
  };
}

export async function deleteExpiredCounters(db: Db): Promise<void> {
  await db.delete(rateCounters).where(lt(rateCounters.expiresAt, new Date()));
}

export async function deleteOldCache(db: Db, olderThanDays: number): Promise<void> {
  await db
    .delete(providerCache)
    .where(lt(providerCache.expiresAt, new Date(Date.now() - olderThanDays * 86_400_000)));
}
