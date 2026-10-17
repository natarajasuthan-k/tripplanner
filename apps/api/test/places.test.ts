import type { PlacesResponse } from '@tripplanner/shared';
import { describe, expect, it, vi } from 'vitest';
import { mapGeoapifyPlace } from '../src/integrations/geoapifyPlaces';
import { upsertDestinations } from '../src/repositories/destinationRepo';
import { getPlaces } from '../src/services/placesService';
import { db, makeApp, setupDb } from './helpers/app';
import { testEnv } from './helpers/env';
import { searchDestination } from './helpers/fixtures';

setupDb();
const { request } = makeApp();

describe('E3 GET /destinations/{id}/places', () => {
  it('returns fixture places in fake mode with attribution (AC3.1)', async () => {
    const kyoto = await searchDestination(request);
    const res = await request(`/destinations/${kyoto.id}/places?limit=3`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PlacesResponse;
    expect(body.items).toHaveLength(3);
    expect(body.items[0]).toMatchObject({ name: 'Fushimi Inari Taisha', categoryLabel: 'Sight' });
    expect(body.attribution).toContain('OpenStreetMap');
  });

  it('is 404 for unknown or malformed destination ids', async () => {
    expect(
      (await request('/destinations/0192f0c4-7a1e-7c3a-9b2e-5d1f2a3b4c5d/places')).status,
    ).toBe(404);
    expect((await request('/destinations/not-a-uuid/places')).status).toBe(404);
  });
});

describe('Geoapify places (live mode)', () => {
  const liveEnv = { ...testEnv, PROVIDER_MODE: 'live' as const };
  const feature = (place_id: string, name: string, categories: string[]) => ({
    properties: {
      place_id,
      name,
      categories,
      lat: 35,
      lon: 135,
      address_line2: 'Kyoto',
      wiki_and_media: { wikipedia: 'en:Fushimi Inari-taisha' },
      datasource: { raw: { osm_type: 'w', osm_id: 123 } },
    },
  });

  async function liveDestination() {
    const [row] = await upsertDestinations(db, 'geoapify', [
      {
        providerPlaceId: 'geo-kyoto',
        name: 'Kyoto',
        region: null,
        country: 'Japan',
        countryCode: 'JP',
        lat: 35,
        lon: 135,
      },
    ]);
    return row!;
  }

  it('maps, caches for later calls, and filters by the city place id', async () => {
    const dest = await liveDestination();
    const fetchFn = vi.fn(async () =>
      Response.json({
        features: [
          feature('p1', 'Fushimi Inari Taisha', ['tourism.sights', 'religion.place_of_worship']),
          feature('p2', 'Kyoto National Museum', ['entertainment.museum']),
          { properties: { place_id: 'p3' } }, // incomplete → skipped
        ],
      }),
    );
    const first = await getPlaces(db, liveEnv, dest.id, 30, fetchFn);
    // Both requests return the same features here; duplicates are merged by name.
    expect(first.items.map((p) => [p.name, p.categoryLabel])).toEqual([
      ['Kyoto National Museum', 'Museum'],
      ['Fushimi Inari Taisha', 'Sight'],
    ]);
    expect(first.items[0]!.wikipediaUrl).toBe('https://en.wikipedia.org/wiki/Fushimi_Inari-taisha');
    expect(first.items[0]!.sourceUrl).toBe('https://www.openstreetmap.org/way/123');

    await getPlaces(db, liveEnv, dest.id, 30, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(2); // primary + secondary, then served from cache
    const urls = fetchFn.mock.calls.map((c) => new URL(String((c as unknown[])[0])));
    expect(urls.map((u) => u.searchParams.get('filter'))).toEqual([
      'place:geo-kyoto',
      'place:geo-kyoto',
    ]);
    expect(urls[0]!.searchParams.get('categories')).toContain('tourism.sights');
    expect(urls[1]!.searchParams.get('categories')).toContain('leisure.park');
  });

  it('falls back to stale cache, else PROVIDER_UNAVAILABLE (AC3.3)', async () => {
    const dest = await liveDestination();
    const failing = vi.fn(async () => new Response('down', { status: 502 }));
    await expect(getPlaces(db, liveEnv, dest.id, 30, failing)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });

    const ok = vi.fn(async () =>
      Response.json({ features: [feature('p1', 'Gion', ['tourism.attraction'])] }),
    );
    await getPlaces(db, liveEnv, dest.id, 30, ok);
    await db.execute(
      (await import('drizzle-orm'))
        .sql`update provider_cache set expires_at = now() - interval '1 day'`,
    );
    const stale = await getPlaces(db, liveEnv, dest.id, 30, failing);
    expect(stale.stale).toBe(true);
    expect(stale.items.map((p) => p.name)).toEqual(['Gion']);
  });

  it('keeps the main results when the secondary request fails', async () => {
    const dest = await liveDestination();
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const categories = new URL(String(input)).searchParams.get('categories') ?? '';
      return categories.includes('leisure.park')
        ? new Response('bad category', { status: 400 })
        : Response.json({ features: [feature('p1', 'Gion', ['tourism.attraction'])] });
    });
    const res = await getPlaces(db, liveEnv, dest.id, 30, fetchFn);
    expect(res.items.map((p) => p.name)).toEqual(['Gion']);
  });

  it('skips places without a name or position', () => {
    expect(mapGeoapifyPlace({ place_id: 'x', name: 'X' })).toBeNull();
  });
});
