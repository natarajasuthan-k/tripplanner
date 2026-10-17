// Development / E2E seed data — backend-spec §10.
// Usage: pnpm db:seed            (DATABASE_URL from env, defaults to local Docker Postgres)
// Refuses to touch non-local databases unless --force is given.
import { addDays, todayAoE } from '@tripplanner/shared';
import { sql } from 'drizzle-orm';
import { uuidv7 } from '../lib/ids';
import { insertDeleteRequest } from '../repositories/deleteRequestRepo';
import { upsertDestinations } from '../repositories/destinationRepo';
import { insertTripWithDays, setPublished } from '../repositories/tripRepo';
import { createDb, type Db } from './client';

/** Fixed 43-char codes so tests and demos can open seeded trips directly. */
export const SEED_TOKENS = {
  published: {
    organiser: 'seedPublishedOrganiser'.padEnd(43, 'A'),
    edit: 'seedPublishedEdit'.padEnd(43, 'A'),
    view: 'seedPublishedView'.padEnd(43, 'A'),
  },
  completed: {
    organiser: 'seedCompletedOrganiser'.padEnd(43, 'B'),
    edit: 'seedCompletedEdit'.padEnd(43, 'B'),
    view: 'seedCompletedView'.padEnd(43, 'B'),
  },
  requested: {
    organiser: 'seedRequestedOrganiser'.padEnd(43, 'C'),
    edit: 'seedRequestedEdit'.padEnd(43, 'C'),
    view: 'seedRequestedView'.padEnd(43, 'C'),
  },
  copied: {
    organiser: 'seedCopiedOrganiser'.padEnd(43, 'D'),
    edit: 'seedCopiedEdit'.padEnd(43, 'D'),
    view: 'seedCopiedView'.padEnd(43, 'D'),
  },
  full: {
    organiser: 'seedFullOrganiser'.padEnd(43, 'E'),
    edit: 'seedFullEdit'.padEnd(43, 'E'),
    view: 'seedFullView'.padEnd(43, 'E'),
  },
} as const;

const DESTINATIONS = [
  {
    providerPlaceId: 'fake:kyoto',
    name: 'Kyoto',
    region: 'Kyoto Prefecture',
    country: 'Japan',
    countryCode: 'JP',
    lat: 35.0116,
    lon: 135.7681,
  },
  {
    providerPlaceId: 'fake:paris',
    name: 'Paris',
    region: 'Île-de-France',
    country: 'France',
    countryCode: 'FR',
    lat: 48.8566,
    lon: 2.3522,
  },
  {
    providerPlaceId: 'fake:goa',
    name: 'Panaji',
    region: 'Goa',
    country: 'India',
    countryCode: 'IN',
    lat: 15.4909,
    lon: 73.8278,
  },
];

interface SeedTrip {
  key: keyof typeof SEED_TOKENS;
  name: string;
  destination: number;
  from: number; // days from today (AoE)
  days: string[];
  published?: boolean;
  copiedFrom?: keyof typeof SEED_TOKENS;
}

const TRIPS: SeedTrip[] = [
  {
    key: 'published',
    name: 'Kyoto in Autumn',
    destination: 0,
    from: 30,
    days: [
      'Arrive KIX, check in near Gion',
      '• Fushimi Inari Taisha (Sight)\nTea in Uji',
      'Arashiyama bamboo grove',
    ],
    published: true,
  },
  {
    key: 'completed',
    name: 'Paris Long Weekend',
    destination: 1,
    from: -10,
    days: ['Louvre in the morning', 'Montmartre walk', 'Seine boat at sunset'],
    published: true,
  },
  { key: 'requested', name: 'Goa Beach Break', destination: 2, from: 20, days: ['', '', ''] },
  {
    key: 'copied',
    name: 'Kyoto Again',
    destination: 0,
    from: 60,
    days: ['Arrive KIX, check in near Gion', '• Fushimi Inari Taisha (Sight)\nTea in Uji'],
    copiedFrom: 'published',
  },
  {
    key: 'full',
    name: 'Paris Grand Tour',
    destination: 1,
    from: 45,
    days: ['Eiffel Tower', 'Louvre', 'Versailles day trip', 'Le Marais', 'Musée d’Orsay'],
  },
];

export async function seed(db: Db): Promise<void> {
  await db.execute(
    sql`TRUNCATE destinations, trips, days, day_presence, delete_requests, provider_cache,
        trip_slug_history, rate_counters RESTART IDENTITY CASCADE`,
  );
  const destinations = await upsertDestinations(db, 'fake', DESTINATIONS);
  const today = todayAoE();
  const ids = new Map<string, string>();

  for (const t of TRIPS) {
    const tripId = uuidv7();
    ids.set(t.key, tripId);
    const fromDate = addDays(today, t.from);
    const tokens = SEED_TOKENS[t.key];
    const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await insertTripWithDays(
      db,
      {
        id: tripId,
        name: t.name,
        nameKey: t.name.toLowerCase(),
        slug,
        destinationId: destinations[t.destination]!.id,
        fromDate,
        toDate: addDays(fromDate, t.days.length - 1),
        organiserToken: tokens.organiser,
        editToken: tokens.edit,
        viewToken: tokens.view,
        copiedFromTripId: t.copiedFrom ? (ids.get(t.copiedFrom) ?? null) : null,
      },
      t.days.map((text, i) => ({
        id: uuidv7(),
        tripId,
        position: i + 1,
        text,
        ...(text ? { updatedByName: 'Seed', updatedAt: new Date() } : {}),
      })),
    );
    if (t.published) await setPublished(db, tripId, true);
  }
  await insertDeleteRequest(db, ids.get('requested')!, 'Ravi');
}

async function main() {
  const url = process.env.DATABASE_URL ?? 'postgres://trip:trip@localhost:5432/tripplanner';
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && !process.argv.includes('--force')) {
    console.error(`Refusing to seed non-local database host "${host}". Pass --force to override.`);
    process.exit(1);
  }
  const { db, close } = createDb(url);
  try {
    await seed(db);
    console.log('Seeded. Open e.g. /o/' + SEED_TOKENS.published.organiser);
  } finally {
    await close();
  }
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop()!)
) {
  void main();
}
