import { addDays, todayAoE, type CreateTripResponse } from '@tripplanner/shared';
import { eq } from 'drizzle-orm';
import { trips } from '../../src/db/schema';
import { db, type makeApp } from './app';

type Request = ReturnType<typeof makeApp>['request'];

export async function searchDestination(request: Request, q = 'kyoto') {
  const res = await request(`/destinations/search?q=${encodeURIComponent(q)}`);
  const body = (await res.json()) as { items: { id: string; name: string }[] };
  return body.items[0]!;
}

export async function createTestTrip(
  request: Request,
  overrides: Partial<{ name: string; fromDate: string; toDate: string }> = {},
) {
  const destination = await searchDestination(request);
  const today = todayAoE();
  const res = await request('/trips', {
    method: 'POST',
    body: {
      name: 'Kyoto Winter',
      destinationId: destination.id,
      fromDate: addDays(today, 10),
      toDate: addDays(today, 12),
      ...overrides,
    },
  });
  if (res.status !== 201) throw new Error(`createTestTrip: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as CreateTripResponse;
  const links = body.trip.links!;
  return {
    body,
    organiser: links.organiserToken!,
    editor: links.editToken,
    viewer: links.viewToken,
    days: body.trip.days,
  };
}

/** Move a trip into the past so it counts as Completed (BR8). */
export async function makeCompleted(organiserToken: string) {
  const past = addDays(todayAoE(), -5);
  await db
    .update(trips)
    .set({ fromDate: addDays(past, -2), toDate: past })
    .where(eq(trips.organiserToken, organiserToken));
}
