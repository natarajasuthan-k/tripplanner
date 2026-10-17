# Backend Spec — Trip Planner

> Server architecture, data model and business rules. Implements the endpoints defined in `api-contract-spec.md`, and traces to `goal-spec.md` (F#, AC#) and `frontend-spec.md`.
>
> **Status:** v0.2 — open questions resolved (see §13 Decision Log). Items still marked *(proposed)* are defaults that have not been explicitly confirmed.

## 1. Tech Stack
| Concern | Choice | Why |
|---------|---------------------|-----|
| Language | **TypeScript** (strict mode) | Same language as the frontend; validation rules and types can be shared. |
| Framework | **Hono** + `@hono/zod-openapi` | Tiny and fast. Runs on Cloudflare Workers, Node and Bun, so we can move hosts later. It also produces an OpenAPI description of the API from the code. |
| Runtime / hosting | **Cloudflare Workers** (free plan) | No slow first request after idle time (meets the 2.5s load target). Same provider as the frontend, which is also served by a Worker with static assets. Generous free requests per day. |
| Database | **PostgreSQL on Neon** (free plan) | Standard Postgres, so it can grow for a mass-market launch. It supports branches for testing. |
| DB driver | **`postgres` (postgres.js)** over TCP (Workers `nodejs_compat`) | The same driver works with Neon and the local Docker Postgres; Neon's serverless driver would need an extra proxy locally. One short-lived connection per request. Cloudflare Hyperdrive can be added later for connection pooling. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Light and type-safe. |
| Validation | **Zod** (in a package shared with the frontend) | One set of rules on both sides; the frontend's checks match the server's. |
| Email | **Resend** (free plan) | Simple API; enough free emails for the pilot. |
| Destination / places data | **Geoapify** (Autocomplete + Places APIs, free plan) | One API key covers both the destination suggestion list (F1) and places of interest (F5). |
| Rate limiting | Cloudflare Workers **Rate Limiting binding**; a counter table in Postgres for the email-based limit | Free and built in. |
| Scheduled jobs | Cloudflare **Cron Triggers** | Clean up expired editing presence and old cache and rate-limit rows. |
| Testing | **Vitest** (Node environment, using Hono's `app.request()`); Postgres in Docker for integration tests; **MSW** to fake the outside providers. `@cloudflare/vitest-pool-workers` is optional later, if Worker-runtime specifics need testing. | See §11. |

> Free-plan limits must be checked again at implementation time (Workers requests per day; Neon storage and compute; Resend emails per day; Geoapify credits per day). §6 estimates usage.

## 2. Architecture Overview
**Repository layout: monorepo with pnpm workspaces (QB7)**
```
TravelPlanner/
  specs/                     # these specs
  apps/
    web/                     # React SPA (frontend-spec.md)
    api/                     # Hono API (this spec)
      src/
        index.ts             # Worker entry: app + scheduled() handler
        app.ts               # Hono app, middleware, route registration
        routes/              # HTTP layer: OpenAPI route definitions → call services
          trips.ts  days.ts  presence.ts  published.ts
          deleteRequests.ts  destinations.ts  recover.ts  health.ts
        services/            # Business rules (§4); no HTTP and no SQL
          tripService.ts  dayService.ts  presenceService.ts
          destinationService.ts  placesService.ts  emailService.ts  recoveryService.ts
        repositories/        # Drizzle queries only
        db/
          schema.ts          # Drizzle tables (§3)
          migrations/
          seed.ts
        integrations/
          geoapify.ts  resend.ts
        middleware/
          tokenAuth.ts       # code in the URL → role + trip (§5)
          rateLimit.ts  errorHandler.ts  requestLog.ts  cors.ts
        lib/
          tokens.ts  slug.ts  dates.ts  hmac.ts  errors.ts
      test/
  packages/
    shared/                  # Zod schemas, API types, error codes, constants (limits)
```

**How a request flows:** `Worker fetch` → middleware (CORS, request ID, logging with codes hidden, rate limit) → route (checks the input with Zod) → `tokenAuth` (looks up the trip, works out the role, checks permission) → service (business rules) → repository (Drizzle, then Neon) → response, shaped exactly as `api-contract-spec.md` defines.

## 3. Data Model
IDs are **UUID v7** (sortable by time). Timestamps are `timestamptz` in UTC. Trip dates are `date` values with no time zone (goal-spec §9).

### 3.1 `destinations`
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| provider | text | not null, default `'geoapify'` | Data source |
| provider_place_id | text | not null; unique with `provider` | The provider's ID for the place, used to match "same destination" (F6) |
| name | text | not null | e.g. "Kyoto" |
| region | text | null | State or prefecture |
| country | text | not null | |
| country_code | char(2) | not null | ISO 3166-1 country code |
| lat, lon | double precision | not null | |
| created_at | timestamptz | not null default now() | |

### 3.2 `trips`
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | Internal only; never shown in any URL |
| name | text | not null, 3–80 characters | Shown as entered (with extra spaces trimmed) |
| name_key | text | **unique** | `lower(name with spaces collapsed)`; enforces unique names ignoring case (BR2) |
| slug | text | **unique** | Public address used in `/explore/:slug` (BR3) |
| destination_id | uuid | FK → destinations, not null | |
| from_date | date | not null | |
| to_date | date | not null, check `to_date >= from_date` and `to_date - from_date <= 59` | At most 60 days, counting both ends |
| organiser_token | text | unique, not null | 256-bit random code, base64url (BR1) |
| edit_token | text | unique, not null | |
| view_token | text | unique, not null | |
| organiser_email_hash | text | null, indexed | **HMAC-SHA256 of the normalised email.** The plain email is **never stored** (BR11). |
| is_published | boolean | not null default false | Private by default |
| published_at | timestamptz | null | |
| copied_from_trip_id | uuid | null, **no FK** (BR13) | For analytics only; no lasting link to the original |
| version | integer | not null default 1 | Version check for trip edits |
| created_at, updated_at | timestamptz | not null | |

Indexes: `(is_published, published_at desc)`; `(destination_id, is_published)`; trigram index on `name` for directory search *(proposed)*.

### 3.3 `days`
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| trip_id | uuid | FK → trips **ON DELETE CASCADE** | |
| position | smallint | not null; unique with `trip_id`; 1–60 | Day number (Day 1, Day 2, …) |
| text | text | not null default `''`, at most 5,000 characters | Free text |
| version | integer | not null default 1 | Version check (BR7) |
| updated_by_name | text | null, 1–40 characters | Display name of the last editor |
| updated_at | timestamptz | null | Time of the last content edit |

> The calendar date of a day is **calculated** as `from_date + (position − 1)` and returned by the API. Storing the position instead of the date makes changing the dates simple (BR5, QB5).

### 3.4 `day_presence`
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| day_id | uuid | FK → days ON DELETE CASCADE | |
| session_id | text | not null, at most 64 characters | Random ID per browser tab, made by the client |
| display_name | text | not null, 1–40 characters | |
| last_seen_at | timestamptz | not null | |
| | | **PK (day_id, session_id)** | |

### 3.5 `delete_requests`
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| trip_id | uuid | FK → trips ON DELETE CASCADE | |
| requested_by_name | text | not null, 1–40 characters | |
| status | text | `pending` \| `dismissed` | Approving one deletes the trip, which removes all its rows |
| created_at | timestamptz | not null | |
| resolved_at | timestamptz | null | |

### 3.6 `provider_cache`
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| cache_key | text | PK | e.g. `ac:<normalised query>` or `places:<destination_id>` |
| payload | jsonb | not null | Normalised response from the provider |
| fetched_at | timestamptz | not null | |
| expires_at | timestamptz | not null, indexed | Searches: 7 days; places: 7 days *(proposed)* |

### 3.7 `trip_slug_history`
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| old_slug | text | PK | A slug the trip used before a rename |
| trip_id | uuid | FK → trips ON DELETE CASCADE, indexed | |
| created_at | timestamptz | not null | |

### 3.8 `rate_counters`
Used only for limits that Cloudflare's per-IP binding can't express, such as per email address.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| bucket_key | text | PK | e.g. `recover:<email_hash>:<hour>` |
| count | integer | not null | |
| expires_at | timestamptz | not null, indexed | |

### 3.9 `trip_contributors` (goal Q25)
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| trip_id | uuid | FK → trips ON DELETE CASCADE | |
| contributor_hash | text | not null | HMAC-SHA256(`EMAIL_HMAC_SECRET`, `"contributor:" + trip_id + ":" + lower(display name)`), hex. Never the name itself. |
| first_seen_at | timestamptz | not null default now() | |
| | | **PK (trip_id, contributor_hash)** | |

Used only for the pilot metric (docs/pilot.md). It is never returned by the API.

### Relationships
- `destinations` 1 — N `trips`
- `trips` 1 — N `days` (exactly one per day of the trip)
- `trips` 1 — N `delete_requests`
- `trips` 1 — N `trip_slug_history`
- `trips` 1 — N `trip_contributors`
- `days` 1 — N `day_presence`
- Deleting a trip removes its days, editing presence, delete requests and slug history (CASCADE).

## 4. Business Rules
| ID | Rule | Traces to |
|----|------|-----------|
| **BR1 Codes** | Each trip gets three separate codes, each 32 bytes from a secure random source (`crypto.getRandomValues`), written in base64url (43 characters). If two codes ever clash (practically impossible), try again. Codes can't be changed in the MVP. | F2 |
| **BR2 Name** | Trim the name and collapse repeated spaces; it must be 3–80 characters. `name_key = lower(name)`. A `name_key` that already exists means `409 TRIP_NAME_TAKEN`. Renaming follows the same rule. | F1, AC1.5 |
| **BR3 Slug** | `slug` is the name turned into a URL-friendly form (letters, digits and dashes). Names are unique, so the slug is too; if it ever clashes, add `-2`, `-3` and so on. **The slug is regenerated when the trip is renamed.** The old slug is saved in `trip_slug_history`, and fetching it returns the trip together with `canonicalSlug`, so the frontend can redirect (QB9). When checking a new slug, both `trips.slug` and `trip_slug_history.old_slug` count as taken. **Live slugs take priority:** if a new trip's slug matches an old slug in the history, that history entry is deleted and its redirect stops working. | F4, AC5.3 |
| **BR4 Dates** | "Today" is worked out in **AoE (UTC−12, "anywhere on earth")**, so it is never stricter than the user's local date. `from_date ≥ today(AoE)`; `to_date ≥ from_date`; at most 60 days, counting both ends. The same rules apply when editing the trip, except that an unchanged past `from_date` is allowed (goal Q24). | AC1.2–1.4, AC10.1 |
| **BR5 Day generation & date changes** | When a trip is created: insert positions 1…N with empty text. When the dates change to N′ days: if N′ > N, add empty days N+1…N′; if N′ < N, positions N′+1…N are removed. **Day content stays with its position**: Day 1 is still Day 1 when the trip moves to new dates (QB5). | F3, F8, AC1.7, AC10.2–10.4 |
| **BR6 Confirming a shrink** | A `PATCH` that would remove days whose text isn't empty is rejected with `409 DAYS_WOULD_BE_REMOVED`, listing those days (`position`, `date`, a preview of the text). The client sends it again with `confirmRemoveDays: true`. | AC10.2 |
| **BR7 Version check** | Saving a day runs `UPDATE days SET text=$t, version=version+1, updated_by_name=$n, updated_at=now() WHERE id=$id AND trip_id=$trip AND version=$v`. If no row changes, the day is fetched again and `409 DAY_VERSION_CONFLICT` is returned with it. Trip edits use the same pattern with `trips.version`. | AC2.4 |
| **BR8 Completed** | A trip is **Completed** when `to_date < today(AoE)`. This is worked out on every read, so no job is needed. While Completed, every change to content (trip edits, day saves, editing presence) is rejected with `409 TRIP_COMPLETED`. Publish, un-publish, delete, delete requests and approve/dismiss are still allowed. | F9, AC11.1–11.2 |
| **BR9 Permissions** | Server-side check, using the matrix in frontend-spec §6. The role comes **only** from which code matched (§5). Any action not allowed returns `403 FORBIDDEN`. | F2, AC9.2 |
| **BR10 Editing presence** | `PUT presence` inserts or updates `(day_id, session_id)` with `last_seen_at = now()`. `DELETE presence` removes the row. Reading a trip returns presence rows with `last_seen_at > now() − 30s`, leaving out the caller's own `session_id`. The cleanup job removes rows older than 5 minutes. | F3, AC2.6 |
| **BR11 Email privacy** | Normalise the email (trim and lower-case), then `organiser_email_hash = HMAC-SHA256(EMAIL_HMAC_SECRET, email)`. **The plain email is used only to send that one message and is never stored or logged.** Recovery hashes the email that was typed in, finds the trips, and sends to the typed address. | F10, goal-spec §10 |
| **BR12 Recovery** | `POST /recover` **always** returns `202` with the same body. If trips match, one email lists every trip (name, dates, organiser link). Limits: 3 per hour per email hash and 10 per hour per IP; going over the limit returns `429`. Emails are sent with `waitUntil` so the response time doesn't reveal anything. | AC12.3–12.5 |
| **BR13 Copy plan** | `POST /trips` with `copyFromSlug`: the source must be **published**, otherwise `404`. The new trip gets new codes, is private, and has `copied_from_trip_id` set (no FK, so deleting the source doesn't affect it). Days `1…min(N_src, N_new)` copy the source's text; any extra days are empty. `updated_by_name` is set to `null` on copied days. | F12, AC14.1–14.4 |
| **BR14 Delete & requests** | **Organiser delete:** removes the trip and everything under it (all codes then return `404`). **Delete request:** every request inserts its own `pending` row, and there's no limit on how many are pending (QB8). The trip response lists every pending request (`requestedByName`, `createdAt`), newest first. **Dismiss all:** sets every pending request to `dismissed`. **Approve:** the same as an organiser delete. | F7, AC7.1–7.3, AC8.1 |
| **BR15 Publishing** | `is_published` can be set to true or false at any time by the organiser, including on Completed trips. `published_at` is set each time the trip is published. The directory and earlier-trips lists only ever include `is_published = true`. | F4, F6, AC5.x, AC4.1 |
| **BR16 Text cleaning** | Stored as plain text, never as HTML. Unicode is normalised to NFC form; control characters other than `\n` and `\t` are removed; length is checked **after** normalising. The frontend shows it as plain text. | goal-spec §10 |
| **BR18 Contributor count** | After a successful day save (E10), insert `(trip_id, contributor_hash)` and ignore it if it already exists. Recording failures are logged and never fail the save. The hash is keyed per trip, so the same name on two trips can't be linked. | goal §11, Q25 |
| **BR17 Destination check** | `destinationId` must exist in `destinations`. Destinations are added to the table **only from Geoapify results returned by destination search** (E2), and updated by `(provider, provider_place_id)` if they already exist. Clients can't create arbitrary destinations; an unknown `destinationId` is a `400 VALIDATION_ERROR` on that field. | F1 |

## 5. Authentication & Authorization
- **Mechanism:** No accounts. The **code** in the request (where it goes is set in `api-contract-spec.md`, e.g. `/trips/:token/...`) is looked up in this order:
  - `organiser_token`, then role `organiser`
  - `edit_token`, then role `editor`
  - `view_token`, then role `viewer`
  - No match: `404 NOT_FOUND`. It is never `401`, so the API never reveals whether a trip exists.

  The lookup is a single query using indexed equality on all three columns.
- **Public routes** (no code): published directory, published trip by slug, destination search, places, create trip, recover, health.
- **Display name:** Sent in the request body (`editorName`) when saving a day, sending presence or requesting deletion. It isn't verified and is used only to show who did something.
- **Passwords / password hashing:** Not applicable. The HMAC for emails is described in BR11.
- **Code lifetime:** Codes never expire; they stop working when the trip is deleted.
- **Roles & permissions:** See frontend-spec §6 Permission Matrix and BR8–BR9.

| Role | Can do |
|------|--------|
| organiser | Everything: read, edit the trip and days, presence, publish and un-publish, delete, approve and dismiss requests, read all three links |
| editor | Read, edit days, presence, read the edit and view links, request deletion |
| viewer | Read only |
| public | Read published trips by slug, browse the directory, search destinations, see places, create trips, recover links |

## 6. External Integrations
| Service | Purpose | API | Free-plan Notes *(check at build time)* |
|---------|---------|-----|---------------------------------|
| **Geoapify Autocomplete** | Destination suggestions (F1) | `GET /v1/geocode/autocomplete?text=&type=city&format=json` | About 3,000 credits a day. Results are cached for 7 days per normalised query. The OpenStreetMap credit must be shown. **Duplicates are merged:** the same name, country and coordinates (to 2 decimal places, about 1 km) count as one city, and the entry with a region is kept (QB11). |
| **Geoapify Places** | Places of interest (F5) | Four calls, `GET /v2/places?filter=place:<id>&limit=100`: the **main** call (`categories=entertainment.museum,heritage,tourism.sights,tourism.attraction`) plus **one call each** for `beach`, `religion.place_of_worship` and `leisure.park`. They are separate because in big cities small temples and parks number in the thousands and would otherwise fill the 100 results. If an extra call fails, only that category is missing. | Cached for 7 days per destination. **Ranked** (QB11): places with a Wikipedia/Wikidata entry first, then by category weight (museums, heritage, forts, attractions > beaches > sights > places of worship > parks). Parks, places of worship and memorials are kept only if they have a Wikipedia/Wikidata entry, unless fewer than 10 results would remain. At most 30 are returned. |
| **Resend** | Organiser-link emails (F10) | `POST /emails` | About 100 a day and 3,000 a month. Needs a verified sending domain, or Resend's test sender while developing. |
| **Neon** | PostgreSQL | `postgres` driver over TCP, with `sslmode=require` | About 0.5 GB of storage. Waking from idle adds less than about 1s to the first query. |
| **Cloudflare Workers** | API hosting | — | About 100k requests a day on the free plan. |

**Usage estimate:** One trip page open with 5 people, each re-fetching every 10s, is about 1,800 requests an hour. A pilot with a few groups planning a few hours a day stays well under 100k a day. Re-fetching stops while the browser tab is hidden (frontend-spec §8).

**When a provider fails:**
- **Places:** If the provider errors or times out (3s limit), the API returns `503 PROVIDER_UNAVAILABLE`. If an expired cache entry exists, it is returned instead, with `stale: true` (AC3.3).
- **Destination search:** A provider error returns `503 PROVIDER_UNAVAILABLE`; the trip creation form shows it as a field error.
- **Email:** If sending fails, the error is logged (without the address) and **the trip is still created**. The create response includes `emailSent: false`.

**Normalised place shape** (cached and returned): `{ id, name, category, description?, address?, lat, lon, sourceUrl?, wikipediaUrl? }`.

## 7. Validation & Error Handling
- **Input checks:** Zod schemas from `packages/shared` run on every route through `@hono/zod-openapi`. Unknown fields are removed.
- **Error format:** Must match `api-contract-spec.md` §2: `{ error: { code, message, details? } }`. A single error handler maps the app's error types to HTTP status and code. Unexpected errors return `500 INTERNAL_ERROR` without exposing the stack trace.
- **Error codes the backend produces (to be finalised in the API contract):**

| Code | HTTP Status |
|------|------|
| `VALIDATION_ERROR` | 400 |
| `NOT_FOUND` | 404 |
| `FORBIDDEN` | 403 |
| `TRIP_NAME_TAKEN` | 409 |
| `DAY_VERSION_CONFLICT` | 409 |
| `TRIP_VERSION_CONFLICT` | 409 |
| `DAYS_WOULD_BE_REMOVED` | 409 |
| `TRIP_COMPLETED` | 409 |
| `RATE_LIMITED` | 429 |
| `PROVIDER_UNAVAILABLE` | 503 |
| `INTERNAL_ERROR` | 500 |

- **Logging:** Structured JSON logs with a request ID, method, the **route pattern** (e.g. `/trips/:token/days/:dayId`, never the real code), status and duration.
  - **Never logged:** codes, emails or the text of days.
  - **Viewing:** Cloudflare Workers Logs (free).

## 8. Security
- **CORS:** Only `CORS_ORIGIN` (the frontend's address) is allowed; methods `GET, POST, PUT, PATCH, DELETE`; no credentials (cookies aren't used).
- **Transport:** HTTPS only (handled by Cloudflare). Response headers: `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` on any response reached with a code.
- **Rate limits *(proposed)*:**

| What | Limit |
|------|-------|
| Create trip | 10 per hour per IP |
| Write requests (day saves, trip edits, publish, delete requests) | 120 per minute per IP |
| Presence | 20 per minute per IP |
| Destination search | 60 per minute per IP |
| Recover | 3 per hour per email and 10 per hour per IP |
| Reads | 300 per minute per IP |

- **Guessing codes:** Each code has 256 bits of randomness, which makes guessing infeasible. Unknown codes return `404`, and the per-IP read limit slows any attempt.
- **SQL injection:** Prevented by using only parameterised queries (Drizzle). No raw SQL is built from strings.
- **Cross-site scripting (XSS):** Text is stored as plain text and the frontend never renders HTML (BR16).
- **Secrets:** Kept in Wrangler secrets (`wrangler secret put`), never in the repository. `.dev.vars` is git-ignored for local development.
- **Storing codes:** Codes are stored in plain form so they can be shown again (share dialog) and emailed (recovery). The database is reachable only by the API's credentials. **Later improvement:** encrypt codes at rest *(QB6)*.
- **Personal data:** Only display names and email HMACs are stored, and both are removed when the trip is deleted.

## 9. Environment & Config
| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string | Yes | `postgres://user:pass@ep-xxx.neon.tech/trip?sslmode=require` |
| `GEOAPIFY_API_KEY` | Destination search and places | Yes | `secret` |
| `RESEND_API_KEY` | Sending email | Yes (prod) | `re_…` |
| `EMAIL_FROM` | Sender address | Yes (prod) | `Trip Planner <links@tripplanner.example>` |
| `EMAIL_HMAC_SECRET` | Secret key for email HMACs (32+ bytes). **Changing it breaks recovery for existing trips.** | Yes | `secret` |
| `APP_PUBLIC_URL` | Frontend address used to build links in emails | Yes | `https://tripplanner.example` |
| `CORS_ORIGIN` | Frontend address allowed by CORS | Yes | `https://tripplanner.example` |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` | No (`info`) | `info` |
| `PROVIDER_MODE` | `live` calls Geoapify; `fake` serves built-in fixture destinations and places (local dev, tests). **Production: `live`.** | Yes | `fake` |
| `EMAIL_MODE` | `live` sends through Resend; `log` only logs a redacted line, without the address. **Production: `live`.** | Yes | `log` |
| `RATE_LIMIT_*` | Rate-limit bindings (configured in `wrangler.toml`) | Yes | — |

## 10. Migrations & Seeding
- **Migrations:** `drizzle-kit generate` creates SQL migration files, which are committed to the repository. `drizzle-kit migrate` runs in CI before each deploy. Migrations only add things (no destructive changes without a two-step plan). The pilot uses one Neon database, and a Neon branch gives each pull request its own test database *(proposed)*.
- **Seed data (`db/seed.ts`, development and test only):**
  - 3 destinations (Kyoto, Paris, Goa)
  - 5 trips:
    - 2 published, one of them Completed
    - 1 private trip with a pending delete request
    - 1 copied from a published trip
    - 1 multi-day trip with text on every day
  - Fixed codes so Playwright tests can use them directly.
- **Scheduled cleanup (Cron, hourly):** Delete `day_presence` rows older than 5 minutes, `rate_counters` rows past `expires_at`, and `provider_cache` rows more than 30 days past expiry.

## 11. Testing Strategy
- **Unit (Vitest):**
  - Generating and encoding codes
  - Slug creation and clash handling
  - Name normalisation
  - Date rules in AoE, including edge cases on both sides of midnight
  - Working out days to add or remove (BR5/BR6)
  - Copy truncation (BR13)
  - Email normalisation and HMAC
  - Text cleaning (BR16)
  - Mapping errors to HTTP responses
- **Integration (real Postgres in Docker, providers faked with MSW):**
  - Every service rule BR1–BR17
  - The version check when two saves happen at once (two parallel updates; exactly one wins)
  - Delete removing everything under a trip
  - Presence expiring after 30s
  - Completed trips rejecting changes
  - Recovery always giving the same response, plus its rate limit
  - Falling back to the stale places cache
- **API / contract tests:**
  - Run each route through Hono's `app.request()` and check the response against the **OpenAPI document** built from the route definitions.
  - That document is compared with `api-contract-spec.md` during review.
  - A test checks every route against the permission matrix (each role, each route, expected status).
- **Security tests:** Codes never appear in logs (capture the logger output); `404` for unknown codes; CORS rejects other origins.
- **CI (GitHub Actions):** Type check, lint, unit and integration tests (Postgres service container), then build. On `main`: run migrations, then `wrangler deploy`.

## 12. Deployment

> Step-by-step setup, secrets, verification, rollback and restore are in [`docs/deployment.md`](../docs/deployment.md). The Worker refuses to serve in production when its configuration is unsafe (`apps/api/src/lib/config.ts`), and `/health` reports `config: error`.
- **Hosting:**
  - API on **Cloudflare Workers** (`api.<domain>` or `*.workers.dev`).
  - Frontend on a **Cloudflare Worker with static assets** (`apps/web/wrangler.jsonc`).
  - Database on **Neon**.
  - Email through **Resend**.
- **Environments:**

| Environment | Setup |
|-------------|-------|
| `local` | `wrangler dev` + Postgres in Docker + MSW or test provider keys |
| `preview` | Per pull request: a Workers preview deploy plus a Neon branch *(proposed)* |
| `production` | Main Worker + main Neon database |

- **CI/CD:** GitHub Actions, as described in §11. Wrangler secrets are set once per environment.
- **Backups:** Neon's built-in point-in-time restore (limited window on the free plan), plus a weekly `pg_dump` run by GitHub Actions and stored as a private build artifact *(proposed)*. This supports goal-spec §11, zero data loss.
- **Moving to a bigger setup later:** Hono and Drizzle run unchanged on Node. Moving to a paid Postgres or a container host needs only configuration changes.

## 13. Decision Log
| # | Question | Decision |
|---|----------|----------|
| QB1 | Hosting and runtime | **Cloudflare Workers + Hono.** |
| QB2 | Database | **Neon Postgres** (with Drizzle ORM). |
| QB3 | Destination and places provider | **Geoapify for both** (Autocomplete + Places). |
| QB4 | Email provider | **Resend.** |
| QB5 | When the dates change, does content follow day number or calendar date? | **Day number:** Day 1 stays Day 1. Shortening removes days from the end, with confirmation. |
| QB6 | How codes are stored | **Plain for the MVP**, with database access restricted. Encrypting them at rest is a later improvement. |
| QB7 | Repository layout | **Monorepo** (pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`). |
| QB8 | Several delete requests on one trip | **Keep them all.** The organiser sees every pending request and can Approve (delete) or Dismiss all. |
| QB9 | Slug after a rename | **Regenerate it; old slugs redirect** (`trip_slug_history`). Live slugs take priority over old ones. |
| QB10 | Conditional GET for the trip re-fetch | **Yes:** `GET /trips/{token}` returns a weak `ETag` (SHA-256 of the response, first 16 bytes) and answers `304` when `If-None-Match` matches (API contract QA2). |
| QB11 | How are Geoapify results made useful? (found on live data after the first deploy) | **Rank places of interest and merge duplicate cities.** Neighbourhood parks crowded out major sights (e.g. Chennai), and "Kyoto" was listed twice. See §6. The cache keys are versioned (`ac:v2:`, `places:v3:`) so older cached results are skipped. Each fetch logs how many results each call returned (no names), for tuning. |

## 14. Open Questions
- None at present. URL patterns, request and response shapes, and status codes are defined in `api-contract-spec.md`.
