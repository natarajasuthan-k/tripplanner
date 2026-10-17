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
  const seen = new Set<string>();
  const out: ProviderDestination[] = [];
  for (const raw of body.results ?? []) {
    const mapped = mapGeoapifyResult(raw);
    if (mapped && !seen.has(mapped.providerPlaceId)) {
      seen.add(mapped.providerPlaceId);
      out.push(mapped);
    }
  }
  return out;
}
