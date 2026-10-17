import { addDays, todayAoE, type TripResponse } from '@tripplanner/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { trips } from '../src/db/schema';
import { db, makeApp, setupDb } from './helpers/app';
import { createTestTrip, makeCompleted, searchDestination } from './helpers/fixtures';

setupDb();
const { request } = makeApp();
const today = todayAoE();

const patch = (token: string, body: object) =>
  request(`/trips/${token}`, { method: 'PATCH', body });

async function setDay(token: string, dayId: string, text: string, version = 1) {
  await request(`/trips/${token}/days/${dayId}`, {
    method: 'PUT',
    body: { text, version, editorName: 'Asha' },
  });
}

describe('E6 PATCH /trips/{token}', () => {
  it('renames, regenerates the slug and bumps the version (AC10.1, BR3)', async () => {
    const t = await createTestTrip(request);
    const res = await patch(t.organiser, { version: 1, name: 'Kyoto Snow' });
    expect(res.status).toBe(200);
    const { trip } = (await res.json()) as TripResponse;
    expect(trip).toMatchObject({ name: 'Kyoto Snow', slug: 'kyoto-snow', version: 2 });
  });

  it('only the organiser may edit; editors get 403 before validation', async () => {
    const t = await createTestTrip(request);
    expect((await patch(t.editor, { nonsense: true })).status).toBe(403);
    expect((await patch(t.viewer, { version: 1, name: 'X Y Z' })).status).toBe(403);
  });

  it('rejects an empty change and a stale version', async () => {
    const t = await createTestTrip(request);
    expect((await patch(t.organiser, { version: 1 })).status).toBe(400);
    await patch(t.organiser, { version: 1, name: 'Kyoto Snow' });
    const res = await patch(t.organiser, { version: 1, name: 'Kyoto Rain' });
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: { code: string; details: { current: { version: number } } };
    };
    expect(body.error.code).toBe('TRIP_VERSION_CONFLICT');
    expect(body.error.details.current.version).toBe(2);
  });

  it('enforces unique names except its own (BR2)', async () => {
    await createTestTrip(request, { name: 'Taken Name' });
    const t = await createTestTrip(request, { name: 'Mine' });
    expect((await patch(t.organiser, { version: 1, name: 'taken name' })).status).toBe(409);
    expect((await patch(t.organiser, { version: 1, name: 'MINE' })).status).toBe(200);
  });

  it('applies date rules to the resulting range (AC10.1)', async () => {
    const t = await createTestTrip(request);
    const res = await patch(t.organiser, { version: 1, toDate: addDays(today, 100) });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: { details: { fields: { toDate: [expect.any(String)] } } },
    });
    expect((await patch(t.organiser, { version: 1, fromDate: addDays(today, -1) })).status).toBe(
      400,
    );
  });

  it('lets a trip under way keep its past From date (Q24)', async () => {
    const t = await createTestTrip(request);
    await db
      .update(trips)
      .set({ fromDate: addDays(today, -1), toDate: addDays(today, 1) })
      .where(eq(trips.organiserToken, t.organiser));
    const res = await patch(t.organiser, { version: 1, toDate: addDays(today, 3) });
    expect(res.status).toBe(200);
    expect(((await res.json()) as TripResponse).trip.dayCount).toBe(5);
  });

  it('extends with empty days and keeps content by day number when moving (AC10.3–10.4)', async () => {
    const t = await createTestTrip(request); // 3 days, from today+10
    await setDay(t.organiser, t.days[0]!.id, 'Day one plans');
    const res = await patch(t.organiser, {
      version: 1,
      fromDate: addDays(today, 20),
      toDate: addDays(today, 24),
    });
    const { trip } = (await res.json()) as TripResponse;
    expect(trip.days.map((d) => [d.position, d.date, d.text])).toEqual([
      [1, addDays(today, 20), 'Day one plans'],
      [2, addDays(today, 21), ''],
      [3, addDays(today, 22), ''],
      [4, addDays(today, 23), ''],
      [5, addDays(today, 24), ''],
    ]);
  });

  it('asks for confirmation before removing days with plans (AC10.2, BR6)', async () => {
    const t = await createTestTrip(request); // 3 days
    await setDay(t.organiser, t.days[2]!.id, 'Day three plans');
    const shrink = { version: 1, toDate: addDays(today, 10) }; // 1 day

    const res = await patch(t.organiser, shrink);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: {
        code: 'DAYS_WOULD_BE_REMOVED',
        details: { removedDays: [{ position: 3, textPreview: 'Day three plans' }] },
      },
    });

    const ok = await patch(t.organiser, { ...shrink, confirmRemoveDays: true });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as TripResponse).trip.days).toHaveLength(1);
  });

  it('removes empty days without asking', async () => {
    const t = await createTestTrip(request);
    const res = await patch(t.organiser, { version: 1, toDate: addDays(today, 10) });
    expect(res.status).toBe(200);
  });

  it('changes the destination (must be a known one)', async () => {
    const t = await createTestTrip(request);
    const paris = await searchDestination(request, 'paris');
    const res = await patch(t.organiser, { version: 1, destinationId: paris.id });
    expect(((await res.json()) as TripResponse).trip.destination.name).toBe('Paris');
    const bad = await patch(t.organiser, {
      version: 2,
      destinationId: '0192f0c4-7a1e-7c3a-9b2e-5d1f2a3b4c5d',
    });
    expect(bad.status).toBe(400);
  });

  it('rejects edits on a Completed trip (AC11.2)', async () => {
    const t = await createTestTrip(request);
    await makeCompleted(t.organiser);
    const res = await patch(t.organiser, { version: 1, name: 'Too Late' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'TRIP_COMPLETED' } });
  });
});
