import { describe, expect, it, vi } from 'vitest';
import { mapGeoapifyResult } from '../src/integrations/geoapify';
import { searchDestinations } from '../src/services/destinationService';
import { db, makeApp, setupDb } from './helpers/app';
import { testEnv } from './helpers/env';

setupDb();
const { request } = makeApp();

describe('E2 GET /destinations/search', () => {
  it('returns fixture destinations with stable ids in fake mode (BR17)', async () => {
    const first = await request('/destinations/search?q=kyo');
    expect(first.status).toBe(200);
    const { items } = (await first.json()) as { items: { id: string; name: string }[] };
    expect(items[0]).toMatchObject({ name: 'Kyoto', country: 'Japan', countryCode: 'JP' });

    const again = (await (await request('/destinations/search?q=kyoto')).json()) as typeof first;
    expect((again as unknown as { items: { id: string }[] }).items[0]!.id).toBe(items[0]!.id);
  });

  it('validates the query length', async () => {
    expect((await request('/destinations/search?q=k')).status).toBe(400);
    expect((await request('/destinations/search')).status).toBe(400);
  });
});

describe('Geoapify integration (live mode)', () => {
  const liveEnv = { ...testEnv, PROVIDER_MODE: 'live' as const };
  const okResponse = () =>
    Response.json({
      results: [
        {
          place_id: 'p1',
          city: 'Kyoto',
          state: 'Kyoto Prefecture',
          country: 'Japan',
          country_code: 'jp',
          lat: 35,
          lon: 135.7,
        },
        { place_id: 'bad' }, // incomplete → skipped
      ],
    });

  it('maps results and caches them for later calls', async () => {
    const fetchFn = vi.fn(async () => okResponse());
    const first = await searchDestinations(db, liveEnv, 'Kyoto', 6, fetchFn);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      name: 'Kyoto',
      countryCode: 'JP',
      region: 'Kyoto Prefecture',
    });

    await searchDestinations(db, liveEnv, ' kyoto ', 6, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const url = new URL(String((fetchFn.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('type')).toBe('city');
    expect(url.searchParams.get('apiKey')).toBe('test-key');
  });

  it('returns PROVIDER_UNAVAILABLE when the provider fails and nothing is cached', async () => {
    const fetchFn = vi.fn(async () => new Response('boom', { status: 502 }));
    await expect(searchDestinations(db, liveEnv, 'Paris', 6, fetchFn)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('ignores incomplete results', () => {
    expect(mapGeoapifyResult({ place_id: 'x', city: 'X' })).toBeNull();
  });
});
