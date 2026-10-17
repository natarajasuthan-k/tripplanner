// Geoapify Autocomplete — backend-spec §6. Only city-level results are used as destinations.
import type { ProviderDestination } from '../repositories/destinationRepo';

const AUTOCOMPLETE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';
const TIMEOUT_MS = 3000;

export class ProviderError extends Error {
  override name = 'ProviderError';
}

interface GeoapifyResult {
  place_id?: string;
  city?: string;
  name?: string;
  state?: string;
  country?: string;
  country_code?: string;
  lat?: number;
  lon?: number;
}

export function mapGeoapifyResult(r: GeoapifyResult): ProviderDestination | null {
  const name = r.city ?? r.name;
  if (!r.place_id || !name || !r.country || !r.country_code) return null;
  if (typeof r.lat !== 'number' || typeof r.lon !== 'number') return null;
  return {
    providerPlaceId: r.place_id,
    name,
    region: r.state ?? null,
    country: r.country,
    countryCode: r.country_code.toUpperCase(),
    lat: r.lat,
    lon: r.lon,
  };
}

export async function geoapifyAutocomplete(
  apiKey: string,
  query: string,
  limit: number,
  fetchFn: typeof fetch = fetch,
): Promise<ProviderDestination[]> {
  const url = new URL(AUTOCOMPLETE_URL);
  url.search = new URLSearchParams({
    text: query,
    type: 'city',
    format: 'json',
    limit: String(limit),
    apiKey,
  }).toString();

  let res: Response;
  try {
    res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new ProviderError(`Geoapify request failed: ${(err as Error).name}`);
  }
  if (!res.ok) throw new ProviderError(`Geoapify responded ${res.status}`);

  const body = (await res.json()) as { results?: GeoapifyResult[] };
  return mergeDuplicateDestinations(
    (body.results ?? []).map(mapGeoapifyResult).filter((d): d is ProviderDestination => d !== null),
  );
}

/** Same city if name and country match and coordinates agree to ~1 km (2 decimal places). */
function sameCityKey(d: ProviderDestination): string {
  return [d.name.trim().toLowerCase(), d.countryCode, d.lat.toFixed(2), d.lon.toFixed(2)].join('|');
}

/**
 * Geoapify can return the same city twice (e.g. "Kyoto, Kyoto Prefecture" and "Kyoto" with no
 * region, identical coordinates). Keep one per city, in first-seen order, preferring the entry
 * that has a region.
 */
export function mergeDuplicateDestinations(items: ProviderDestination[]): ProviderDestination[] {
  const byKey = new Map<string, number>();
  const out: ProviderDestination[] = [];
  for (const item of items) {
    const key = sameCityKey(item);
    const existing = byKey.get(key);
    if (existing === undefined) {
      if (out.some((o) => o.providerPlaceId === item.providerPlaceId)) continue;
      byKey.set(key, out.length);
      out.push(item);
    } else if (!out[existing]!.region && item.region) {
      out[existing] = item;
    }
  }
  return out;
}
