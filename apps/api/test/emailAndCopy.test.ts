import { addDays, RECOVER_MESSAGE, todayAoE, type CreateTripResponse } from '@tripplanner/shared';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { EmailMessage } from '../src/integrations/email';
import { db, makeApp, setupDb } from './helpers/app';
import { createTestTrip, searchDestination } from './helpers/fixtures';

setupDb();
const sent: EmailMessage[] = [];
let failEmail = false;
const { request } = makeApp({
  sendEmail: async (_env, message) => {
    if (failEmail) throw new Error('provider down');
    sent.push(message);
  },
});
beforeEach(() => {
  sent.length = 0;
  failEmail = false;
});

const today = todayAoE();

async function create(body: Record<string, unknown>) {
  const destination = await searchDestination(request);
  return request('/trips', {
    method: 'POST',
    body: {
      name: 'Kyoto Winter',
      destinationId: destination.id,
      fromDate: addDays(today, 5),
      toDate: addDays(today, 6),
      ...body,
    },
  });
}

describe('F10 organiser email on create (AC12.1–12.3, BR11)', () => {
  it('emails the organiser link and stores only a hash', async () => {
    const res = await create({ organiserEmail: ' Me@Example.com ' });
    const body = (await res.json()) as CreateTripResponse;
    expect(body.emailSent).toBe(true);
    expect(body.trip.hasRecoveryEmail).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to.trim()).toBe('Me@Example.com');
    expect(sent[0]!.text).toContain(`http://localhost:5173/o/${body.trip.links!.organiserToken}`);

    const rows = await db.execute(sql`select organiser_email_hash from trips`);
    const hash = (rows as unknown as { organiser_email_hash: string }[])[0]!.organiser_email_hash;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    const dump = JSON.stringify(await db.execute(sql`select * from trips`));
    expect(dump.toLowerCase()).not.toContain('example.com');
  });

  it('still creates the trip when sending fails', async () => {
    failEmail = true;
    const res = await create({ organiserEmail: 'me@example.com' });
    expect(res.status).toBe(201);
    expect(((await res.json()) as CreateTripResponse).emailSent).toBe(false);
  });

  it('emailSent is null without an email', async () => {
    const body = (await (await create({})).json()) as CreateTripResponse;
    expect(body.emailSent).toBeNull();
    expect(body.trip.hasRecoveryEmail).toBe(false);
  });
});

describe('E17 POST /recover (AC12.4–12.5, BR12)', () => {
  const recover = (email: string, ip = '1.1.1.1') =>
    request('/recover', { method: 'POST', body: { email }, headers: { 'CF-Connecting-IP': ip } });

  it('sends one email listing every trip for the address, matched case-insensitively', async () => {
    await create({ name: 'Trip One', organiserEmail: 'me@example.com' });
    await create({ name: 'Trip Two', organiserEmail: 'ME@example.com' });
    sent.length = 0;

    const res = await recover('Me@Example.COM');
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ message: RECOVER_MESSAGE });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toContain('Trip One');
    expect(sent[0]!.text).toContain('Trip Two');
  });

  it('gives the identical response for unknown addresses and sends nothing', async () => {
    const res = await recover('nobody@example.com');
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ message: RECOVER_MESSAGE });
    expect(sent).toHaveLength(0);
  });

  it('limits to 3 per hour per address', async () => {
    for (let i = 0; i < 3; i++)
      expect((await recover('me@example.com', `9.9.9.${i}`)).status).toBe(202);
    const res = await recover('me@example.com', '9.9.9.9');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
  });

  it('validates the email', async () => {
    expect((await recover('not-an-email')).status).toBe(400);
  });
});

describe('F12 copy a published plan (BR13, AC14.1–14.4)', () => {
  async function publishedSource() {
    const src = await createTestTrip(request, { name: 'Source Plan' }); // 3 days
    for (const [i, text] of ['A', 'B', 'C'].entries()) {
      await request(`/trips/${src.organiser}/days/${src.days[i]!.id}`, {
        method: 'PUT',
        body: { text: `Day ${text}`, version: 1, editorName: 'Asha' },
      });
    }
    await request(`/trips/${src.organiser}/publish`, { method: 'POST' });
    return src;
  }

  it('copies day text by position into a new private trip', async () => {
    await publishedSource();
    const res = await create({
      name: 'My Copy',
      copyFromSlug: 'source-plan',
      fromDate: addDays(today, 30),
      toDate: addDays(today, 33),
    });
    expect(res.status).toBe(201);
    const { trip } = (await res.json()) as CreateTripResponse;
    expect(trip.status.isPublished).toBe(false);
    expect(trip.days.map((d) => d.text)).toEqual(['Day A', 'Day B', 'Day C', '']);
    expect(trip.days.every((d) => d.updatedByName === null)).toBe(true);
  });

  it('truncates when the new trip is shorter (AC14.3)', async () => {
    await publishedSource();
    const res = await create({
      name: 'Short Copy',
      copyFromSlug: 'source-plan',
      fromDate: addDays(today, 30),
      toDate: addDays(today, 30),
    });
    expect(((await res.json()) as CreateTripResponse).trip.days.map((d) => d.text)).toEqual([
      'Day A',
    ]);
  });

  it('keeps no link to the source (AC14.4)', async () => {
    const src = await publishedSource();
    await create({ name: 'My Copy', copyFromSlug: 'source-plan' });
    expect((await request(`/trips/${src.organiser}`, { method: 'DELETE' })).status).toBe(204);
    const list = await request('/trips/published');
    expect(list.status).toBe(200);
  });

  it('refuses unpublished sources with 404', async () => {
    await createTestTrip(request, { name: 'Private Plan' });
    const res = await create({ name: 'My Copy', copyFromSlug: 'private-plan' });
    expect(res.status).toBe(404);
  });
});
