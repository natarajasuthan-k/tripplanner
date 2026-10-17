import type { TripResponse } from '@tripplanner/shared';
import { describe, expect, it } from 'vitest';
import { makeApp, setupDb } from './helpers/app';
import { createTestTrip, makeCompleted } from './helpers/fixtures';

setupDb();
const { request } = makeApp();

const ask = (token: string, requestedByName: string) =>
  request(`/trips/${token}/delete-requests`, { method: 'POST', body: { requestedByName } });

async function pending(organiser: string) {
  const res = await request(`/trips/${organiser}`);
  return ((await res.json()) as TripResponse).trip.pendingDeleteRequests!;
}

describe('E13 POST /trips/{token}/delete-requests', () => {
  it('records a request without deleting anything (AC8.1)', async () => {
    const t = await createTestTrip(request);
    const res = await ask(t.editor, 'Ravi');
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ deleteRequest: { requestedByName: 'Ravi' } });
    expect((await request(`/trips/${t.editor}`)).status).toBe(200);
  });

  it('keeps every request, newest first (AC7.2–7.3, QB8)', async () => {
    const t = await createTestTrip(request);
    await ask(t.editor, 'Ravi');
    await ask(t.editor, 'Asha');
    expect((await pending(t.organiser)).map((r) => r.requestedByName)).toEqual(['Asha', 'Ravi']);
  });

  it('is only for editors (AC8.2)', async () => {
    const t = await createTestTrip(request);
    expect((await ask(t.organiser, 'Org')).status).toBe(403);
    expect((await ask(t.viewer, 'View')).status).toBe(403);
  });

  it('is still allowed on a Completed trip (BR8)', async () => {
    const t = await createTestTrip(request);
    await makeCompleted(t.organiser);
    expect((await ask(t.editor, 'Ravi')).status).toBe(201);
  });
});

describe('E14 dismiss and E7 approve', () => {
  it('dismisses all pending requests (AC7.2)', async () => {
    const t = await createTestTrip(request);
    await ask(t.editor, 'Ravi');
    await ask(t.editor, 'Asha');
    const res = await request(`/trips/${t.organiser}/delete-requests/dismiss`, { method: 'POST' });
    expect(await res.json()).toEqual({ dismissedCount: 2 });
    expect(await pending(t.organiser)).toEqual([]);
  });

  it('forbids non-organisers from dismissing', async () => {
    const t = await createTestTrip(request);
    const res = await request(`/trips/${t.editor}/delete-requests/dismiss`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('approving = deleting the trip removes it everywhere (AC7.1)', async () => {
    const t = await createTestTrip(request);
    await ask(t.editor, 'Ravi');
    expect((await request(`/trips/${t.organiser}`, { method: 'DELETE' })).status).toBe(204);
    expect((await request(`/trips/${t.editor}`)).status).toBe(404);
  });
});
