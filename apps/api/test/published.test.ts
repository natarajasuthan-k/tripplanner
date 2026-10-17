import type { PublicTripResponse, TripResponse, TripSummaryPage } from '@tripplanner/shared';
import { describe, expect, it } from 'vitest';
import { makeApp, setupDb } from './helpers/app';
import { createTestTrip, makeCompleted, searchDestination } from './helpers/fixtures';

setupDb();
const { request } = makeApp();

const publish = (token: string) => request(`/trips/${token}/publish`, { method: 'POST' });
const unpublish = (token: string) => request(`/trips/${token}/unpublish`, { method: 'POST' });
const list = async (query = '') =>
  (await (await request(`/trips/published${query}`)).json()) as TripSummaryPage;

describe('E8/E9 publish & un-publish (BR15)', () => {
  it('publishes and un-publishes; only the organiser may (AC5.1–5.2)', async () => {
    const t = await createTestTrip(request);
    expect((await publish(t.editor)).status).toBe(403);
    expect((await publish(t.viewer)).status).toBe(403);

    const res = await publish(t.organiser);
    expect(res.status).toBe(200);
    const { status } = (await res.json()) as {
      status: { isPublished: boolean; publishedAt: string };
    };
    expect(status.isPublished).toBe(true);
    expect(status.publishedAt).not.toBeNull();

    expect((await list()).items.map((i) => i.slug)).toEqual(['kyoto-winter']);

    const off = (await (await unpublish(t.organiser)).json()) as { status: object };
    expect(off.status).toMatchObject({ isPublished: false, publishedAt: null });
    expect((await list()).items).toEqual([]);
    expect((await request(`/trips/${t.editor}`)).status).toBe(200); // links still work
  });

  it('is idempotent and allowed on Completed trips (BR8)', async () => {
    const t = await createTestTrip(request);
    await makeCompleted(t.organiser);
    expect((await publish(t.organiser)).status).toBe(200);
    expect((await publish(t.organiser)).status).toBe(200);
    expect((await list()).items).toHaveLength(1);
  });
});

describe('E15 GET /trips/published', () => {
  it('lists only published trips, newest first, with search and filters (AC6.1, AC4.1)', async () => {
    const a = await createTestTrip(request, { name: 'Kyoto Autumn' });
    const b = await createTestTrip(request, { name: 'Kyoto Spring' });
    await createTestTrip(request, { name: 'Kyoto Private' });
    const paris = await searchDestination(request, 'paris');
    const c = await createTestTrip(request, { name: 'Paris Weekend' });
    await request(`/trips/${c.organiser}`, {
      method: 'PATCH',
      body: { version: 1, destinationId: paris.id },
    });
    for (const t of [a, b, c]) await publish(t.organiser);

    expect((await list()).items.map((i) => i.name)).toEqual([
      'Paris Weekend',
      'Kyoto Spring',
      'Kyoto Autumn',
    ]);
    expect((await list('?q=spring')).items.map((i) => i.name)).toEqual(['Kyoto Spring']);
    expect((await list('?q=paris')).items.map((i) => i.name)).toEqual(['Paris Weekend']); // destination name

    const kyotoId = a.body.trip.destination.id;
    const earlier = await list(`?destinationId=${kyotoId}&excludeSlug=kyoto-spring`);
    expect(earlier.items.map((i) => i.name)).toEqual(['Kyoto Autumn']);
  });

  it('paginates', async () => {
    for (const n of ['One', 'Two', 'Three']) {
      const t = await createTestTrip(request, { name: `Trip ${n}` });
      await publish(t.organiser);
    }
    const p1 = await list('?limit=2&page=1');
    expect(p1).toMatchObject({ page: 1, limit: 2, total: 3, hasMore: true });
    expect(p1.items).toHaveLength(2);
    const p2 = await list('?limit=2&page=2');
    expect(p2).toMatchObject({ total: 3, hasMore: false });
    expect(p2.items).toHaveLength(1);
  });

  it('treats LIKE wildcards in q literally', async () => {
    const plain = await createTestTrip(request, { name: 'Kyoto Winter' });
    const percent = await createTestTrip(request, { name: '100% Kyoto' });
    const underscore = await createTestTrip(request, { name: 'Trip_A Kyoto' });
    for (const t of [plain, percent, underscore]) await publish(t.organiser);

    const names = async (q: string) =>
      (await list(`?q=${encodeURIComponent(q)}`)).items.map((i) => i.name);
    expect(await names('%%')).toEqual([]); // wildcards don't match everything
    expect(await names('0%')).toEqual(['100% Kyoto']); // a literal % still matches
    expect(await names('p_A')).toEqual(['Trip_A Kyoto']); // _ is not "any character"
    expect(await names('pXA')).toEqual([]);
  });
});

describe('E16 GET /trips/published/{slug}', () => {
  it('returns a read-only view without links (AC6.2)', async () => {
    const t = await createTestTrip(request);
    await publish(t.organiser);
    const res = await request('/trips/published/kyoto-winter');
    expect(res.status).toBe(200);
    const body = (await res.json()) as PublicTripResponse & { trip: Record<string, unknown> };
    expect(body.access.role).toBe('public');
    expect(body.access.permissions.canCopyPlan).toBe(true);
    expect(body.access.permissions.canEditDays).toBe(false);
    expect(body.trip.canonicalSlug).toBe('kyoto-winter');
    expect(body.trip).not.toHaveProperty('links');
    expect(JSON.stringify(body)).not.toContain(t.editor);
    expect(JSON.stringify(body)).not.toContain(t.organiser);
  });

  it('is 404 for private or unknown trips', async () => {
    await createTestTrip(request);
    expect((await request('/trips/published/kyoto-winter')).status).toBe(404);
    expect((await request('/trips/published/nope')).status).toBe(404);
  });

  it('resolves old slugs after a rename (AC5.3, QB9)', async () => {
    const t = await createTestTrip(request);
    await publish(t.organiser);
    await request(`/trips/${t.organiser}`, {
      method: 'PATCH',
      body: { version: 1, name: 'Kyoto Snow Trip' },
    });
    const body = (await (
      await request('/trips/published/kyoto-winter')
    ).json()) as PublicTripResponse;
    expect(body.trip.canonicalSlug).toBe('kyoto-snow-trip');
  });

  it('lets a new trip take over an old slug (live slugs win)', async () => {
    const old = await createTestTrip(request);
    await request(`/trips/${old.organiser}`, {
      method: 'PATCH',
      body: { version: 1, name: 'Kyoto Snow Trip' },
    });
    const fresh = await createTestTrip(request, { name: 'Kyoto Winter' });
    expect(fresh.body.trip.slug).toBe('kyoto-winter');
    await publish(fresh.organiser);
    const body = (await (
      await request('/trips/published/kyoto-winter')
    ).json()) as PublicTripResponse;
    expect(body.trip.canonicalSlug).toBe('kyoto-winter');
    const view = (await (await request(`/trips/${fresh.organiser}`)).json()) as TripResponse;
    expect(body.trip.name).toBe(view.trip.name);
  });
});
