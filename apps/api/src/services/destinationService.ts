// E2 destination search — backend-spec §6, BR17.
import type { Destination } from '@tripplanner/shared';
import type { Db } from '../db/client';
import type { Env } from '../env';
import { fakeAutocomplete } from '../integrations/fakeDestinations';
import { geoapifyAutocomplete, ProviderError } from '../integrations/geoapify';
import { AppError } from '../lib/errors';
import { getCached, putCached } from '../repositories/cacheRepo';
import { upsertDestinations, type ProviderDestination } from '../repositories/destinationRepo';
import { toDestination } from './views';

const SEARCH_CACHE_TTL_SECONDS = 7 * 86_400;
const PROVIDER_FETCH_LIMIT = 10;

export async function searchDestinations(
  db: Db,
  env: Env,
  query: string,
  limit: number,
  fetchFn: typeof fetch = fetch,
): Promise<Destination[]> {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
  let results: ProviderDestination[];
  let provider: string;

  if (env.PROVIDER_MODE === 'fake') {
    provider = 'fake';
    results = fakeAutocomplete(normalized, PROVIDER_FETCH_LIMIT);
  } else {
    provider = 'geoapify';
    const key = `ac:${normalized}`;
    const cached = await getCached<ProviderDestination[]>(db, key);
    if (cached?.fresh) {
      results = cached.payload;
    } else {
      try {
        results = await geoapifyAutocomplete(
          env.GEOAPIFY_API_KEY,
          normalized,
          PROVIDER_FETCH_LIMIT,
          fetchFn,
        );
        await putCached(db, key, results, SEARCH_CACHE_TTL_SECONDS);
      } catch (err) {
        if (!(err instanceof ProviderError)) throw err;
        if (!cached) {
          throw new AppError(
            'PROVIDER_UNAVAILABLE',
            'Destination search is unavailable right now. Please try again.',
          );
        }
        results = cached.payload; // stale but usable
      }
    }
  }

  const rows = await upsertDestinations(db, provider, results.slice(0, limit));
  return rows.map(toDestination);
}
