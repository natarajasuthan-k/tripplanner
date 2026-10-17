import { addDays, todayAoE, type CreateTripResponse, type TripResponse } from '@tripplanner/shared';
import { describe, expect, it } from 'vitest';
import { makeApp, setupDb } from './helpers/app';
import { createTestTrip, makeCompleted, searchDestination } from './helpers/fixtures';

setupDb();
const { request } = makeApp();
const today = todayAoE();

async function postTrip(body: Record<string, unknown>) {
  const destination = await searchDestination(request);
  return request('/trips', {
    method: 'POST',
    body: {
      name: 'Kyoto Winter',
      destinationId: destination.id,
      fromDate: addDays(today, 1),
      toDate: addDays(today, 3),
      ...body,
    },
  });
}

describe('E4 POST /trips', () => {
  it('creates a private trip with one empty day per date and three codes (AC1.1, AC1.7)', async () => {
    const res = await postTrip({ name: '  Kyoto   Winter ' });
    expect(res.status).toBe(201);
    const { trip, access, emailSent } = (await res.json()) as CreateTripResponse;

    expect(trip.name).toBe('Kyoto Winter');
    expect(trip.slug).toBe('kyoto-winter');
    expect(trip.status).toEqual({ isPublished: false, publishedAt: null, isCompleted: false });
    expect(trip.dayCount).toBe(3);
    expect(trip.days.map((d) => [d.position, d.date, d.text, d.version])).toEqual([
      [1, addDays(today, 1), '', 1],
      [2, addDays(today, 2), '', 1],
      [3, addDays(today, 3), '', 1],
    ]);
    const { organiserToken, editToken, viewToken } = trip.links!;
    for (const t of [organiserToken, editToken, viewToken]) expect(t).toMatch(/^[\w-]{43}$/);
    expect(new Set([organiserToken, editToken, viewToken]).size).toBe(3);
    expect(access.role).toBe('organiser');
    expect(trip.pendingDeleteRequests).toEqual([]);
    expect(trip.hasRecoveryEmail).toBe(false);
    expect(emailSent).toBeNull();
  });

  it('allows a one-day trip (AC1.3)', async () => {
    const res = await postTrip({ fromDate: today, toDate: today });
    expect(res.status).toBe(201);
  });

  it('rejects past dates, reversed ranges and >60 days with field errors (AC1.2–1.4)', async () => {
    const cases = [
      [{ fromDate: addDays(today, -2) }, 'fromDate'],
      [{ toDate: addDays(today, 0), fromDate: addDays(today, 1) }, 'toDate'],
      [{ fromDate: today, toDate: addDays(today, 60) }, 'toDate'],
    ] as const;
    for (const [body, field] of cases) {
      const res = await postTrip(body);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string; details: { fields: object } } };
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(Object.keys(json.error.details.fields)).toContain(field);
    }
  });

  it('rejects duplicate names case-insensitively (AC1.5)', async () => {
    expect((await postTrip({ name: 'Kyoto Winter' })).status).toBe(201);
    const res = await postTrip({ name: 'KYOTO  winter' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: { code: 'TRIP_NAME_TAKEN', details: { field: 'name' } },
    });
  });

  it('reports an unknown destination as a field error (BR17)', async () => {
    const res = await postTrip({ destinationId: '0192f0c4-7a1e-7c3a-9b2e-5d1f2a3b4c5d' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: { details: { fields: { destinationId: [expect.any(String)] } } },
    });
  });

  it('gives each trip a unique slug even when names slugify alike (BR3)', async () => {
    await postTrip({ name: 'Kyoto Winter!' });
    const res = await postTrip({ name: 'Kyoto - Winter' });
    expect(((await res.json()) as CreateTripResponse).trip.slug).toBe('kyoto-winter-2');
  });
});

describe('E5 GET /trips/{token}', () => {
  it('returns the role-specific view for each code (F2, AC2.1, AC2.8, AC9.1)', async () => {
    const t = await createTestTrip(request);

    const org = (await (await request(`/trips/${t.organiser}`)).json()) as TripResponse;
    expect(org.access.role).toBe('organiser');
    expect(org.trip.links).toEqual({
      organiserToken: t.organiser,
      editToken: t.editor,
      viewToken: t.viewer,
    });

    const ed = (await (await request(`/trips/${t.editor}`)).json()) as TripResponse;
    expect(ed.access.role).toBe('editor');
    expect(ed.trip.links).toEqual({ editToken: t.editor, viewToken: t.viewer });
    expect(ed.trip.pendingDeleteRequests).toBeNull();
    expect(ed.trip.hasRecoveryEmail).toBeNull();
    expect(ed.access.permissions).toMatchObject({ canEditDays: true, canViewOrganiserLink: false });

    const vw = (await (await request(`/trips/${t.viewer}`)).json()) as TripResponse;
    expect(vw.access.role).toBe('viewer');
    expect(vw.trip.links).toBeNull();
    expect(vw.access.permissions.canEditDays).toBe(false);
  });

  it('returns 404 for unknown, malformed or deleted codes (AC2.5)', async () => {
    expect((await request(`/trips/${'x'.repeat(43)}`)).status).toBe(404);
    expect((await request('/trips/short')).status).toBe(404);
    const t = await createTestTrip(request);
    await request(`/trips/${t.organiser}`, { method: 'DELETE' });
    const res = await request(`/trips/${t.editor}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('supports If-None-Match with a weak ETag (QA2)', async () => {
    const t = await createTestTrip(request);
    const first = await request(`/trips/${t.editor}`);
    const etag = first.headers.get('ETag')!;
    expect(etag).toMatch(/^W\/".+"$/);
    expect(first.headers.get('Cache-Control')).toBe('no-store');

    const same = await request(`/trips/${t.editor}`, { headers: { 'If-None-Match': etag } });
    expect(same.status).toBe(304);

    await request(`/trips/${t.editor}/days/${t.days[0]!.id}`, {
      method: 'PUT',
      body: { text: 'changed', version: 1, editorName: 'Asha' },
    });
    const changed = await request(`/trips/${t.editor}`, { headers: { 'If-None-Match': etag } });
    expect(changed.status).toBe(200);
  });

  it('reports Completed trips with content editing disabled (BR8, AC11.1)', async () => {
    const t = await createTestTrip(request);
    await makeCompleted(t.organiser);
    const body = (await (await request(`/trips/${t.organiser}`)).json()) as TripResponse;
    expect(body.trip.status.isCompleted).toBe(true);
    expect(body.access.permissions).toMatchObject({
      canEditDays: false,
      canEditTrip: false,
      canDelete: true,
    });
  });
});

describe('E7 DELETE /trips/{token}', () => {
  it('lets only the organiser delete (AC7.1)', async () => {
    const t = await createTestTrip(request);
    expect((await request(`/trips/${t.editor}`, { method: 'DELETE' })).status).toBe(403);
    expect((await request(`/trips/${t.viewer}`, { method: 'DELETE' })).status).toBe(403);
    expect((await request(`/trips/${t.organiser}`, { method: 'DELETE' })).status).toBe(204);
    for (const code of [t.organiser, t.editor, t.viewer]) {
      expect((await request(`/trips/${code}`)).status).toBe(404);
    }
  });

  it('still works on a Completed trip (BR8)', async () => {
    const t = await createTestTrip(request);
    await makeCompleted(t.organiser);
    expect((await request(`/trips/${t.organiser}`, { method: 'DELETE' })).status).toBe(204);
  });
});
