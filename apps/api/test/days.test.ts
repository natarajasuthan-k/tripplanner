import type { Day, TripResponse } from '@tripplanner/shared';
import { describe, expect, it } from 'vitest';
import { makeApp, setupDb } from './helpers/app';
import { createTestTrip, makeCompleted } from './helpers/fixtures';

setupDb();
const { request } = makeApp();

const save = (token: string, dayId: string, body: object, session = 'session-aaaa') =>
  request(`/trips/${token}/days/${dayId}`, {
    method: 'PUT',
    body,
    headers: { 'X-Session-Id': session },
  });

describe('E10 PUT /trips/{token}/days/{dayId}', () => {
  it('saves text, bumps the version and records the editor (AC2.3)', async () => {
    const t = await createTestTrip(request);
    const day = t.days[0]!;
    const res = await save(t.editor, day.id, {
      text: 'Arrive KIX\r\nFushimi Inari\u0007',
      version: 1,
      editorName: ' Asha ',
    });
    expect(res.status).toBe(200);
    const { day: saved } = (await res.json()) as { day: Day };
    expect(saved).toMatchObject({
      id: day.id,
      text: 'Arrive KIX\nFushimi Inari',
      version: 2,
      updatedByName: 'Asha',
    });
    expect(saved.updatedAt).not.toBeNull();
  });

  it('rejects a stale version with the latest day (AC2.4, BR7)', async () => {
    const t = await createTestTrip(request);
    const dayId = t.days[0]!.id;
    await save(t.editor, dayId, { text: 'first', version: 1, editorName: 'Asha' });
    const res = await save(t.organiser, dayId, { text: 'second', version: 1, editorName: 'Ravi' });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; details: { current: Day } } };
    expect(body.error.code).toBe('DAY_VERSION_CONFLICT');
    expect(body.error.details.current).toMatchObject({ text: 'first', version: 2 });
  });

  it('lets exactly one of two concurrent saves win (BR7)', async () => {
    const t = await createTestTrip(request);
    const dayId = t.days[0]!.id;
    const results = await Promise.all([
      save(t.editor, dayId, { text: 'a', version: 1, editorName: 'A' }),
      save(t.organiser, dayId, { text: 'b', version: 1, editorName: 'B' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('forbids viewers before validating the body (AC9.2, api-contract §2 order)', async () => {
    const t = await createTestTrip(request);
    const res = await save(t.viewer, t.days[0]!.id, { nonsense: true });
    expect(res.status).toBe(403);
  });

  it('returns 404 for a day of another trip, before validation', async () => {
    const a = await createTestTrip(request, { name: 'Trip A' });
    const b = await createTestTrip(request, { name: 'Trip B' });
    expect((await save(a.editor, b.days[0]!.id, {})).status).toBe(404);
    expect((await save(a.editor, 'not-a-uuid', {})).status).toBe(404);
  });

  it('enforces the 5,000 character limit', async () => {
    const t = await createTestTrip(request);
    const res = await save(t.editor, t.days[0]!.id, {
      text: 'x'.repeat(5001),
      version: 1,
      editorName: 'A',
    });
    expect(res.status).toBe(400);
  });

  it('rejects saves on a Completed trip (AC11.1, BR8)', async () => {
    const t = await createTestTrip(request);
    await makeCompleted(t.organiser);
    const res = await save(t.organiser, t.days[0]!.id, { text: 'x', version: 1, editorName: 'A' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'TRIP_COMPLETED' } });
  });
});

describe('E11/E12 presence', () => {
  const heartbeat = (token: string, dayId: string, sessionId: string, editorName: string) =>
    request(`/trips/${token}/days/${dayId}/presence`, {
      method: 'PUT',
      body: { sessionId, editorName },
      headers: { 'X-Session-Id': sessionId },
    });

  async function editorsOf(token: string, session: string) {
    const res = await request(`/trips/${token}`, { headers: { 'X-Session-Id': session } });
    return ((await res.json()) as TripResponse).trip.days[0]!.editors.map((e) => e.displayName);
  }

  it('shows other editors but never the caller’s own session (AC2.6, BR10)', async () => {
    const t = await createTestTrip(request);
    const dayId = t.days[0]!.id;
    expect((await heartbeat(t.editor, dayId, 'session-asha', 'Asha')).status).toBe(204);

    expect(await editorsOf(t.organiser, 'session-ravi')).toEqual(['Asha']);
    expect(await editorsOf(t.editor, 'session-asha')).toEqual([]);
    expect(await editorsOf(t.viewer, 'session-view')).toEqual([]); // viewers never see presence
  });

  it('removes presence on stop and is idempotent (E12)', async () => {
    const t = await createTestTrip(request);
    const dayId = t.days[0]!.id;
    await heartbeat(t.editor, dayId, 'session-asha', 'Asha');
    const stop = () =>
      request(`/trips/${t.editor}/days/${dayId}/presence/session-asha`, { method: 'DELETE' });
    expect((await stop()).status).toBe(204);
    expect((await stop()).status).toBe(204);
    expect(await editorsOf(t.organiser, 'session-ravi')).toEqual([]);
  });

  it('forbids viewers and rejects Completed trips', async () => {
    const t = await createTestTrip(request);
    const dayId = t.days[0]!.id;
    expect((await heartbeat(t.viewer, dayId, 'session-view', 'V')).status).toBe(403);
    await makeCompleted(t.organiser);
    expect((await heartbeat(t.editor, dayId, 'session-asha', 'A')).status).toBe(409);
  });
});
