import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API = 'http://127.0.0.1:8787/api/v1';

/** Seed codes from apps/api/src/db/seed.ts (fixed for E2E). */
export const SEED = {
  published: {
    organiser: 'seedPublishedOrganiser'.padEnd(43, 'A'),
    edit: 'seedPublishedEdit'.padEnd(43, 'A'),
  },
  completed: { edit: 'seedCompletedEdit'.padEnd(43, 'B') },
  requested: { organiser: 'seedRequestedOrganiser'.padEnd(43, 'C') },
};

export const unique = (prefix: string) =>
  `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function isoDays(fromToday: number): string {
  const d = new Date(Date.now() + fromToday * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export interface CreatedTrip {
  organiser: string;
  edit: string;
  view: string;
  slug: string;
  dayIds: string[];
}

/**
 * Creates a trip through the API. A random CF-Connecting-IP keeps the per-IP hourly creation
 * limit (backend BR) from interfering between tests; Cloudflare overwrites it in production.
 */
export async function createTripViaApi(
  request: APIRequestContext,
  opts: { name?: string; days?: number; q?: string } = {},
): Promise<CreatedTrip> {
  const search = await request.get(`${API}/destinations/search?q=${opts.q ?? 'kyoto'}`);
  const destination = ((await search.json()) as { items: { id: string }[] }).items[0]!;
  const res = await request.post(`${API}/trips`, {
    headers: {
      'CF-Connecting-IP': `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
    data: {
      name: opts.name ?? unique('E2E Trip'),
      destinationId: destination.id,
      fromDate: isoDays(14),
      toDate: isoDays(14 + (opts.days ?? 3) - 1),
    },
  });
  expect(res.status()).toBe(201);
  const { trip } = (await res.json()) as {
    trip: {
      slug: string;
      links: { organiserToken: string; editToken: string; viewToken: string };
      days: { id: string }[];
    };
  };
  return {
    organiser: trip.links.organiserToken,
    edit: trip.links.editToken,
    view: trip.links.viewToken,
    slug: trip.slug,
    dayIds: trip.days.map((d) => d.id),
  };
}

/** Pre-set a display name on this page's origin so editing doesn't prompt. */
export async function setDisplayName(page: Page, name: string) {
  await page.addInitScript((n) => {
    try {
      localStorage.setItem('tp.displayName', n);
      localStorage.setItem('tp.tipsSeen', JSON.stringify(['organiser', 'editor', 'viewer']));
    } catch {
      // ignore
    }
  }, name);
}

/** On narrow screens the side panel sits behind the Plan / Ideas tabs. */
export async function showIdeas(page: Page) {
  await page.getByRole('heading', { level: 1 }).waitFor(); // trip loaded → tabs rendered
  const ideasTab = page.getByRole('tab', { name: 'Ideas', exact: true });
  if (await ideasTab.isVisible()) await ideasTab.click();
}

export async function showPlan(page: Page) {
  await page.getByRole('heading', { level: 1 }).waitFor();
  const planTab = page.getByRole('tab', { name: 'Plan', exact: true });
  if (await planTab.isVisible()) await planTab.click();
}

export const dayBox = (page: Page, position: number) =>
  page.getByLabel(`Plans for day ${position}`, { exact: true });
