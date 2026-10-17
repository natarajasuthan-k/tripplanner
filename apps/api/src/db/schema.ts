// Drizzle schema — backend-spec §3. Generate migrations with `pnpm db:generate`.
import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// §3.1
export const destinations = pgTable(
  'destinations',
  {
    id: uuid('id').primaryKey(),
    provider: text('provider').notNull().default('geoapify'),
    providerPlaceId: text('provider_place_id').notNull(),
    name: text('name').notNull(),
    region: text('region'),
    country: text('country').notNull(),
    countryCode: char('country_code', { length: 2 }).notNull(),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [unique('destinations_provider_place_uq').on(t.provider, t.providerPlaceId)],
);

// §3.2
export const trips = pgTable(
  'trips',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull().unique('trips_name_key_uq'),
    slug: text('slug').notNull().unique('trips_slug_uq'),
    destinationId: uuid('destination_id')
      .notNull()
      .references(() => destinations.id),
    fromDate: date('from_date', { mode: 'string' }).notNull(),
    toDate: date('to_date', { mode: 'string' }).notNull(),
    organiserToken: text('organiser_token').notNull().unique('trips_organiser_token_uq'),
    editToken: text('edit_token').notNull().unique('trips_edit_token_uq'),
    viewToken: text('view_token').notNull().unique('trips_view_token_uq'),
    organiserEmailHash: text('organiser_email_hash'),
    isPublished: boolean('is_published').notNull().default(false),
    publishedAt: timestamptz('published_at'),
    copiedFromTripId: uuid('copied_from_trip_id'), // intentionally no FK (BR13)
    version: integer('version').notNull().default(1),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('trips_name_len_ck', sql`char_length(${t.name}) between 3 and 80`),
    check('trips_dates_order_ck', sql`${t.toDate} >= ${t.fromDate}`),
    check('trips_max_days_ck', sql`${t.toDate} - ${t.fromDate} <= 59`),
    index('trips_published_idx').on(t.isPublished, t.publishedAt.desc()),
    index('trips_destination_published_idx').on(t.destinationId, t.isPublished),
    index('trips_email_hash_idx').on(t.organiserEmailHash),
  ],
);

// §3.3
export const days = pgTable(
  'days',
  {
    id: uuid('id').primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    text: text('text').notNull().default(''),
    version: integer('version').notNull().default(1),
    updatedByName: text('updated_by_name'),
    updatedAt: timestamptz('updated_at'),
  },
  (t) => [
    unique('days_trip_position_uq').on(t.tripId, t.position),
    check('days_position_ck', sql`${t.position} between 1 and 60`),
    check('days_text_len_ck', sql`char_length(${t.text}) <= 5000`),
  ],
);

// §3.4
export const dayPresence = pgTable(
  'day_presence',
  {
    dayId: uuid('day_id')
      .notNull()
      .references(() => days.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    displayName: text('display_name').notNull(),
    lastSeenAt: timestamptz('last_seen_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.dayId, t.sessionId] })],
);

// §3.5
export const deleteRequests = pgTable(
  'delete_requests',
  {
    id: uuid('id').primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    requestedByName: text('requested_by_name').notNull(),
    status: text('status', { enum: ['pending', 'dismissed'] })
      .notNull()
      .default('pending'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    resolvedAt: timestamptz('resolved_at'),
  },
  (t) => [index('delete_requests_trip_status_idx').on(t.tripId, t.status)],
);

// §3.6
export const providerCache = pgTable(
  'provider_cache',
  {
    cacheKey: text('cache_key').primaryKey(),
    payload: jsonb('payload').notNull(),
    fetchedAt: timestamptz('fetched_at').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
  },
  (t) => [index('provider_cache_expires_idx').on(t.expiresAt)],
);

// §3.7
export const tripSlugHistory = pgTable(
  'trip_slug_history',
  {
    oldSlug: text('old_slug').primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('trip_slug_history_trip_idx').on(t.tripId)],
);

// §3.8
export const rateCounters = pgTable(
  'rate_counters',
  {
    bucketKey: text('bucket_key').primaryKey(),
    count: integer('count').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
  },
  (t) => [index('rate_counters_expires_idx').on(t.expiresAt)],
);
