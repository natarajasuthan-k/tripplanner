// Geoapify Places — backend-spec §6 (F5). Results are normalised to api-contract §3 "Place".
import type { Place } from '@tripplanner/shared';
import { ProviderError } from './geoapify';

const PLACES_URL = 'https://api.geoapify.com/v2/places';
const TIMEOUT_MS = 3000;

/** Requested categories, most specific first; the first match labels the place. */
export const PLACE_CATEGORIES: [category: string, label: string][] = [
  ['entertainment.museum', 'Museum'],
  ['heritage', 'Heritage site'],
  ['tourism.sights', 'Sight'],
  ['tourism.attraction', 'Attraction'],
  ['leisure.park', 'Park'],
];

interface GeoapifyPlaceProps {
  place_id?: string;
  name?: string;
  categories?: string[];
  formatted?: string;
  address_line2?: string;
  lat?: number;
  lon?: number;
  website?: string;
  wiki_and_media?: { wikipedia?: string };
  datasource?: { raw?: { osm_type?: string; osm_id?: number; description?: string } };
}

function wikipediaUrl(ref: string | undefined): string | null {
  if (!ref) return null;
  const [lang, ...rest] = ref.split(':');
  const title = rest.join(':');
  if (!lang || !title) return null;
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function osmUrl(raw: GeoapifyPlaceProps['datasource']): string | null {
  const type = { n: 'node', w: 'way', r: 'relation' }[raw?.raw?.osm_type ?? ''];
  return type && raw?.raw?.osm_id
    ? `https://www.openstreetmap.org/${type}/${raw.raw.osm_id}`
    : null;
}

export function mapGeoapifyPlace(p: GeoapifyPlaceProps): Place | null {
  if (!p.place_id || !p.name || typeof p.lat !== 'number' || typeof p.lon !== 'number') {
    return null;
  }
  const match =
    PLACE_CATEGORIES.find(([cat]) =>
      p.categories?.some((c) => c === cat || c.startsWith(`${cat}.`)),
    ) ?? PLACE_CATEGORIES[3]!;
  return {
    id: `geoapify:${p.place_id}`,
    name: p.name,
    category: match[0],
    categoryLabel: match[1],
    description: p.datasource?.raw?.description?.slice(0, 300) ?? null,
    address: p.address_line2 ?? p.formatted ?? null,
    lat: p.lat,
    lon: p.lon,
    sourceUrl: p.website ?? osmUrl(p.datasource),
    wikipediaUrl: wikipediaUrl(p.wiki_and_media?.wikipedia),
  };
}

export async function geoapifyPlaces(
  apiKey: string,
  providerPlaceId: string,
  limit: number,
  fetchFn: typeof fetch = fetch,
): Promise<Place[]> {
  const url = new URL(PLACES_URL);
  url.search = new URLSearchParams({
    categories: PLACE_CATEGORIES.map(([c]) => c).join(','),
    filter: `place:${providerPlaceId}`,
    limit: String(limit),
    apiKey,
  }).toString();

  let res: Response;
  try {
    res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new ProviderError(`Geoapify places request failed: ${(err as Error).name}`);
  }
  if (!res.ok) throw new ProviderError(`Geoapify places responded ${res.status}`);

  const body = (await res.json()) as { features?: { properties?: GeoapifyPlaceProps }[] };
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const f of body.features ?? []) {
    const place = f.properties ? mapGeoapifyPlace(f.properties) : null;
    if (place && !seen.has(place.name.toLowerCase())) {
      seen.add(place.name.toLowerCase());
      out.push(place);
    }
  }
  return out;
}
