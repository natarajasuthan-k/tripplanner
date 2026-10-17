// Geoapify Places — backend-spec §6 (F5). Results are normalised to api-contract §3 "Place"
// and ranked so well-known sights come first (pilot finding: small parks crowded them out).
import type { Place } from '@tripplanner/shared';
import { ProviderError } from './geoapify';

const PLACES_URL = 'https://api.geoapify.com/v2/places';
const TIMEOUT_MS = 3000;
const FETCH_PER_REQUEST = 100;
/** Below this many results, unknown parks / places of worship are used to fill the list. */
const MIN_RESULTS = 10;

interface CategoryRule {
  category: string;
  label: string;
  weight: number;
  /** Too numerous to be useful unless notable (has a Wikipedia/Wikidata entry). */
  needsWiki?: boolean;
}

/** Most specific first: the first rule matching a place's categories labels and weights it. */
export const PLACE_RULES: CategoryRule[] = [
  { category: 'entertainment.museum', label: 'Museum', weight: 5 },
  { category: 'heritage', label: 'Heritage site', weight: 5 },
  { category: 'tourism.sights.castle', label: 'Castle', weight: 5 },
  { category: 'tourism.sights.fort', label: 'Fort', weight: 5 },
  { category: 'tourism.attraction', label: 'Attraction', weight: 5 },
  { category: 'tourism.sights.memorial', label: 'Memorial', weight: 1, needsWiki: true },
  { category: 'tourism.sights', label: 'Sight', weight: 3 },
  { category: 'beach', label: 'Beach', weight: 4 },
  { category: 'religion.place_of_worship', label: 'Place of worship', weight: 2, needsWiki: true },
  { category: 'leisure.park', label: 'Park', weight: 1, needsWiki: true },
];

/** Main request; a failure here means "suggestions unavailable". */
const PRIMARY = ['entertainment.museum', 'heritage', 'tourism.sights', 'tourism.attraction'];
/**
 * Extra requests, one per category: in big cities small temples and parks number in the
 * thousands, so a combined request's first 100 results never reached beaches or notable parks
 * (Chennai, Mumbai). A failure here only drops that category.
 */
const SECONDARY = [['beach'], ['religion.place_of_worship'], ['leisure.park']];

const WIKI_BOOST = 10;

export interface GeoapifyPlaceProps {
  place_id?: string;
  name?: string;
  categories?: string[];
  formatted?: string;
  address_line2?: string;
  lat?: number;
  lon?: number;
  website?: string;
  wiki_and_media?: { wikipedia?: string; wikidata?: string };
  datasource?: {
    raw?: {
      osm_type?: string;
      osm_id?: number;
      description?: string;
      wikipedia?: string;
      wikidata?: string;
    };
  };
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

function ruleFor(p: GeoapifyPlaceProps): CategoryRule {
  return (
    PLACE_RULES.find((r) =>
      p.categories?.some((c) => c === r.category || c.startsWith(`${r.category}.`)),
    ) ?? PLACE_RULES.find((r) => r.category === 'tourism.attraction')!
  );
}

function hasWiki(p: GeoapifyPlaceProps): boolean {
  return Boolean(
    p.wiki_and_media?.wikipedia ??
    p.wiki_and_media?.wikidata ??
    p.datasource?.raw?.wikipedia ??
    p.datasource?.raw?.wikidata,
  );
}

export function mapGeoapifyPlace(p: GeoapifyPlaceProps): Place | null {
  if (!p.place_id || !p.name || typeof p.lat !== 'number' || typeof p.lon !== 'number') {
    return null;
  }
  const rule = ruleFor(p);
  return {
    id: `geoapify:${p.place_id}`,
    name: p.name,
    category: rule.category,
    categoryLabel: rule.label,
    description: p.datasource?.raw?.description?.slice(0, 300) ?? null,
    address: p.address_line2 ?? p.formatted ?? null,
    lat: p.lat,
    lon: p.lon,
    sourceUrl: p.website ?? osmUrl(p.datasource),
    wikipediaUrl: wikipediaUrl(p.wiki_and_media?.wikipedia ?? p.datasource?.raw?.wikipedia),
  };
}

/**
 * Score, filter and order raw results: notable (Wikipedia/Wikidata) places first, then by category
 * weight; numerous categories (parks, places of worship, memorials) only when notable, unless the
 * list would otherwise be shorter than MIN_RESULTS. Duplicate names are dropped. Stable for ties.
 */
export function rankPlaces(raw: GeoapifyPlaceProps[], limit: number): Place[] {
  const scored = raw
    .map((p, index) => {
      const place = mapGeoapifyPlace(p);
      if (!place) return null;
      const rule = ruleFor(p);
      const wiki = hasWiki(p);
      return { place, index, wiki, rule, score: rule.weight + (wiki ? WIKI_BOOST : 0) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const seen = new Set<string>();
  const unique = scored.filter((s) => {
    const key = s.place.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const keep = unique.filter((s) => s.wiki || !s.rule.needsWiki);
  if (keep.length < MIN_RESULTS) {
    const fill = unique.filter((s) => !s.wiki && s.rule.needsWiki);
    keep.push(...fill.slice(0, MIN_RESULTS - keep.length));
  }
  return keep.slice(0, limit).map((s) => s.place);
}

async function fetchCategories(
  apiKey: string,
  providerPlaceId: string,
  categories: string[],
  fetchFn: typeof fetch,
): Promise<GeoapifyPlaceProps[]> {
  const url = new URL(PLACES_URL);
  url.search = new URLSearchParams({
    categories: categories.join(','),
    filter: `place:${providerPlaceId}`,
    limit: String(FETCH_PER_REQUEST),
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
  return (body.features ?? []).flatMap((f) => (f.properties ? [f.properties] : []));
}

export async function geoapifyPlaces(
  apiKey: string,
  providerPlaceId: string,
  limit: number,
  fetchFn: typeof fetch = fetch,
): Promise<Place[]> {
  const groups = [PRIMARY, ...SECONDARY];
  const results = await Promise.allSettled(
    groups.map((categories) => fetchCategories(apiKey, providerPlaceId, categories, fetchFn)),
  );
  const [primary] = results;
  if (primary!.status === 'rejected') throw primary!.reason;

  // Counts per request (no names or ids) so ranking can be tuned from the logs.
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'places fetched',
      counts: Object.fromEntries(
        groups.map((g, i) => {
          const r = results[i]!;
          return [g.join(','), r.status === 'fulfilled' ? r.value.length : 'failed'];
        }),
      ),
    }),
  );

  return rankPlaces(
    results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    limit,
  );
}
