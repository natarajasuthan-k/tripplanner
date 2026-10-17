// E3 places of interest — backend-spec §6 (F5): 7-day cache per destination, stale fallback.
import type { PlacesResponse, Place } from '@tripplanner/shared';
import type { Db } from '../db/client';
import type { Env } from '../env';
import { fakePlaces } from '../integrations/fakePlaces';
import { ProviderError } from '../integrations/geoapify';
import { geoapifyPlaces } from '../integrations/geoapifyPlaces';
import { AppError, notFound } from '../lib/errors';
import { getCached, putCached } from '../repositories/cacheRepo';
import { findDestination } from '../repositories/destinationRepo';

const PLACES_TTL_SECONDS = 7 * 86_400;
const FETCH_LIMIT = 50;
export const ATTRIBUTION = 'Powered by Geoapify · © OpenStreetMap contributors';

export async function getPlaces(
  db: Db,
  env: Env,
  destinationId: string,
  limit: number,
  fetchFn: typeof fetch = fetch,
): Promise<PlacesResponse> {
  const destination = await findDestination(db, destinationId);
  if (!destination) throw notFound('Destination not found');

  if (env.PROVIDER_MODE === 'fake' || destination.provider === 'fake') {
    return {
      items: fakePlaces(
        destination.providerPlaceId,
        destination.name,
        destination.lat,
        destination.lon,
        limit,
      ),
      stale: false,
      fetchedAt: new Date().toISOString(),
      attribution: ATTRIBUTION,
    };
  }

  // v3: ranked, with one Geoapify request per numerous category; skips older cached entries.
  const key = `places:v3:${destinationId}`;
  const cached = await getCached<Place[]>(db, key);
  if (cached?.fresh) {
    return {
      items: cached.payload.slice(0, limit),
      stale: false,
      fetchedAt: cached.fetchedAt.toISOString(),
      attribution: ATTRIBUTION,
    };
  }

  try {
    const items = await geoapifyPlaces(
      env.GEOAPIFY_API_KEY,
      destination.providerPlaceId,
      FETCH_LIMIT,
      fetchFn,
    );
    await putCached(db, key, items, PLACES_TTL_SECONDS);
    return {
      items: items.slice(0, limit),
      stale: false,
      fetchedAt: new Date().toISOString(),
      attribution: ATTRIBUTION,
    };
  } catch (err) {
    if (!(err instanceof ProviderError)) throw err;
    if (!cached) {
      throw new AppError('PROVIDER_UNAVAILABLE', 'Suggestions are unavailable right now.');
    }
    return {
      items: cached.payload.slice(0, limit),
      stale: true,
      fetchedAt: cached.fetchedAt.toISOString(),
      attribution: ATTRIBUTION,
    };
  }
}
