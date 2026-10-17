import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { destinations } from '../db/schema';
import { uuidv7 } from '../lib/ids';

export type DestinationRow = typeof destinations.$inferSelect;

export interface ProviderDestination {
  providerPlaceId: string;
  name: string;
  region: string | null;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
}

export async function findDestination(db: Db, id: string): Promise<DestinationRow | null> {
  const [row] = await db.select().from(destinations).where(eq(destinations.id, id)).limit(1);
  return row ?? null;
}

/** Insert or refresh provider results; returns rows in the same order as `items` (BR17). */
export async function upsertDestinations(
  db: Db,
  provider: string,
  items: ProviderDestination[],
): Promise<DestinationRow[]> {
  if (items.length === 0) return [];
  const rows = await db
    .insert(destinations)
    .values(items.map((item) => ({ id: uuidv7(), provider, ...item })))
    .onConflictDoUpdate({
      target: [destinations.provider, destinations.providerPlaceId],
      set: {
        name: sql`excluded.name`,
        region: sql`excluded.region`,
        country: sql`excluded.country`,
        countryCode: sql`excluded.country_code`,
        lat: sql`excluded.lat`,
        lon: sql`excluded.lon`,
      },
    })
    .returning();
  const byPlaceId = new Map(rows.map((r) => [r.providerPlaceId, r]));
  return items.map((item) => byPlaceId.get(item.providerPlaceId)!).filter(Boolean);
}
