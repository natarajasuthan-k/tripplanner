# API Contract Spec — Trip Planner

> The single source of truth between frontend and backend. Both sides must follow this document. The OpenAPI document built by `@hono/zod-openapi` (`GET /api/v1/openapi.json`) must match it, and contract tests enforce that (backend-spec §11).
>
> **Status:** v0.2 — open questions resolved (see §7 Decision Log). Traces to goal-spec v0.5, frontend-spec v0.2 and backend-spec v0.2.

## 1. General Conventions
| Convention | Rule |
|------------|------|
| **Base URL** | `https://<api-host>/api/v1`. All paths below are relative to it. |
| **Style** | REST over HTTPS, JSON in both directions (`Content-Type: application/json; charset=utf-8`). |
| **Authentication** | No accounts. **Trip access codes go in the path:** `/trips/{token}/…`. The code that matches decides the role: `organiser`, `editor` or `viewer`. Routes without a code are **public**. |
| **Session header** | `X-Session-Id: <string, 8–64 chars>`: a random ID created once per browser tab. It is sent on `GET /trips/{token}` (so the caller is left out of the "who is editing" list) and on presence calls. It is optional everywhere else. |
| **Request ID** | The server returns an `X-Request-Id` header on every response. Clients may send their own value. |
| **Dates** | Calendar dates are `YYYY-MM-DD` with no time zone (e.g. `2026-12-05`). "Today" means today in **AoE (UTC−12, "anywhere on earth")** (backend BR4). |
| **Timestamps** | ISO 8601 in UTC with milliseconds (e.g. `2026-10-17T09:30:00.000Z`). |
| **IDs** | `dayId`, `destinationId` and delete-request `id` are UUIDs. **Trips have no public ID.** They are addressed by an access code (private) or by their `slug` (published). |
| **Access codes** | 43-character base64url strings (`[A-Za-z0-9_-]{43}`). Codes in any other format return `404`. |
| **Naming** | JSON fields use `camelCase`; error codes use `UPPER_SNAKE_CASE`. |
| **Nulls** | Optional fields with no value are sent as `null`, never left out, unless this spec says a field is only included for some roles. |
| **Pagination** | `?page=` (starts at 1, default 1) and `?limit=` (default 12, maximum 50). Response: `{ items, page, limit, total, hasMore }`. |
| **Versioning** | URL prefix `/v1`. Adding a field doesn't change the version; removing or renaming anything means `/v2`. **Clients must ignore fields they don't recognise.** |
| **Caching** | Responses to routes with a code: `Cache-Control: no-store`. Public lists: `Cache-Control: public, max-age=60`. Places: `public, max-age=3600`. |
| **Rate limits** | When a limit is hit: `429` plus a `Retry-After` header (seconds). Limits are in backend-spec §8. |
| **CORS** | Only the frontend's address is allowed. No cookies or credentials. Allowed request headers: `Content-Type`, `X-Session-Id`, `X-Request-Id`, `If-None-Match`. Headers the browser may read: `ETag`, `X-Request-Id`, `Retry-After`. |
| **Conditional GET** | E5 supports `ETag` / `If-None-Match` (see E5). |
| **Referrer** | Every response includes `Referrer-Policy: no-referrer`. |

### 1.1 Shared Limits (`packages/shared/constants.ts`)
| Constant | Value |
|----------|-------|
| `TRIP_NAME_MIN` / `TRIP_NAME_MAX` | 3 / 80 characters (after trimming and collapsing spaces) |
| `DAY_TEXT_MAX` | 5,000 characters (after NFC normalisation) |
| `TRIP_MAX_DAYS` | 60 (counting both the first and last day) |
| `DISPLAY_NAME_MIN` / `DISPLAY_NAME_MAX` | 1 / 40 characters |
| `EMAIL_MAX` | 254 characters |
| `SEARCH_QUERY_MIN` / `SEARCH_QUERY_MAX` | 2 / 100 characters |
| `PRESENCE_TTL_SECONDS` | 30 |
| `PAGE_LIMIT_DEFAULT` / `PAGE_LIMIT_MAX` | 12 / 50 |

## 2. Standard Error Response
Every non-2xx response has this shape:
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable message (English, safe to show to users)",
    "details": null
  }
}
```

| HTTP | Code | When | `details` |
|------|------|------|-----------|
| 400 | `VALIDATION_ERROR` | The body, query or path has the wrong shape or breaks a rule | `{ "fields": { "<field>": ["message", …] } }` |
| 403 | `FORBIDDEN` | The code is valid but its role isn't allowed this action (e.g. a viewer saving a day) | `null` |
| 404 | `NOT_FOUND` | Unknown or badly formatted code, a deleted trip, an unknown slug, or a `dayId` or `destinationId` that doesn't belong here | `null` |
| 409 | `TRIP_NAME_TAKEN` | Another trip already uses the same name, ignoring upper/lower case | `{ "field": "name" }` |
| 409 | `TRIP_VERSION_CONFLICT` | `PATCH` was sent with an out-of-date trip `version` | `{ "current": TripView }` |
| 409 | `DAY_VERSION_CONFLICT` | A day save was sent with an out-of-date `version` | `{ "current": Day }` |
| 409 | `DAYS_WOULD_BE_REMOVED` | Shortening the dates would remove days that have text, and `confirmRemoveDays` wasn't `true` | `{ "removedDays": [RemovedDay] }` |
| 409 | `TRIP_COMPLETED` | A change to content was attempted on a Completed trip | `null` |
| 429 | `RATE_LIMITED` | A rate limit was hit | `{ "retryAfterSeconds": number }` |
| 500 | `INTERNAL_ERROR` | An unexpected server error | `null` |
| 503 | `PROVIDER_UNAVAILABLE` | Geoapify failed or took too long, and nothing usable was cached | `null` |

**Order of checks** (the first failing check decides the response): `404` (code, slug or resource) → `403` (role) → `400` (input) → `409 TRIP_COMPLETED` → other `409`s → `429` is checked by middleware before all of these.

## 3. Shared Data Types (Schemas)

### Destination
```json
{
  "id": "0192f0c4-7a1e-7c3a-9b2e-5d1f2a3b4c5d",
  "name": "Kyoto",
  "region": "Kyoto Prefecture",
  "country": "Japan",
  "countryCode": "JP",
  "lat": 35.0116,
  "lon": 135.7681
}
```
`region` may be `null`.

### Place
```json
{
  "id": "geoapify:51a3c1…",
  "name": "Fushimi Inari Taisha",
  "category": "tourism.sights",
  "categoryLabel": "Sight",
  "description": "Shinto shrine famous for its thousands of torii gates.",
  "address": "68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto",
  "lat": 34.9671,
  "lon": 135.7727,
  "sourceUrl": "https://www.openstreetmap.org/…",
  "wikipediaUrl": "https://en.wikipedia.org/wiki/Fushimi_Inari-taisha"
}
```
`description`, `address`, `sourceUrl` and `wikipediaUrl` may be `null`.

### Editor (presence)
```json
{ "displayName": "Asha", "lastSeenAt": "2026-10-17T09:30:12.000Z" }
```

### Day
```json
{
  "id": "0192f0c4-8b2f-7d4b-8c3d-6e2f3a4b5c6d",
  "position": 1,
  "date": "2026-12-05",
  "text": "Arrive KIX 14:00\n• Fushimi Inari Taisha (Sight)",
  "version": 4,
  "updatedByName": "Asha",
  "updatedAt": "2026-10-17T09:30:00.000Z",
  "editors": [Editor]
}
```
- `date` is calculated as `fromDate + (position − 1)`.
- `updatedByName` and `updatedAt` are `null` for days that have never been edited.
- `editors` lists only people active within the last 30 seconds, never the caller's own `X-Session-Id`. It is always `[]` for viewer and public responses, and on Completed trips.

### TripStatus
```json
{ "isPublished": false, "publishedAt": null, "isCompleted": false }
```

### Access
```json
{
  "role": "organiser",
  "permissions": {
    "canEditDays": true,
    "canEditTrip": true,
    "canViewShareLinks": true,
    "canViewOrganiserLink": true,
    "canPublish": true,
    "canDelete": true,
    "canRequestDeletion": false,
    "canResolveDeleteRequests": true,
    "canCopyPlan": false
  }
}
```
- `role` is one of `organiser`, `editor`, `viewer` or `public`.
- The permissions are calculated by the server from the role and the trip's state, following the frontend-spec §6 matrix. For example, `canEditDays` and `canEditTrip` are `false` for everyone once the trip is Completed.

### TripLinks
Contains only the codes the caller's role is allowed to see:
```json
{ "organiserToken": "Abc…43chars", "editToken": "Def…43chars", "viewToken": "Ghi…43chars" }
```
| Role | Fields included |
|------|-----------------|
| organiser | all three |
| editor | `editToken` and `viewToken` (no `organiserToken` field at all) |
| viewer / public | `links` is `null` |

The frontend builds the URLs itself: `/o/{organiserToken}`, `/e/{editToken}`, `/v/{viewToken}`.

### DeleteRequest
```json
{ "id": "0192f0c4-…", "requestedByName": "Ravi", "createdAt": "2026-10-16T18:02:00.000Z" }
```

### RemovedDay
```json
{ "position": 6, "date": "2026-12-10", "textPreview": "Day trip to Nara — deer park, Tōdai-ji…" }
```
`textPreview` is the first 120 characters of the day's text.

### TripView (a trip opened with a code)
```json
{
  "name": "Kyoto Winter 2026",
  "slug": "kyoto-winter-2026",
  "destination": Destination,
  "fromDate": "2026-12-05",
  "toDate": "2026-12-10",
  "dayCount": 6,
  "status": TripStatus,
  "version": 3,
  "createdAt": "2026-10-17T09:00:00.000Z",
  "updatedAt": "2026-10-17T09:30:00.000Z",
  "days": [Day],
  "links": TripLinks,
  "hasRecoveryEmail": true,
  "pendingDeleteRequests": [DeleteRequest]
}
```
- `days` are in `position` order.
- `hasRecoveryEmail` and `pendingDeleteRequests` are included **only for the organiser** (newest first). For other roles they are `null`.
- The email itself is **never** returned.

### PublicTripView (a published trip opened by slug)
```json
{
  "name": "Kyoto Winter 2026",
  "slug": "kyoto-winter-2026",
  "canonicalSlug": "kyoto-winter-2026",
  "destination": Destination,
  "fromDate": "2026-12-05",
  "toDate": "2026-12-10",
  "dayCount": 6,
  "status": TripStatus,
  "days": [Day]
}
```
- `canonicalSlug` is the trip's current slug. If it differs from the slug that was requested, the client should change its URL to it (goal AC5.3).
- `Day.editors` is always `[]` in this view.
- There are no `links`, `version` or delete requests.

### TripSummary (lists)
```json
{
  "name": "Kyoto Winter 2026",
  "slug": "kyoto-winter-2026",
  "destination": Destination,
  "fromDate": "2026-12-05",
  "toDate": "2026-12-10",
  "dayCount": 6,
  "isCompleted": false,
  "publishedAt": "2026-10-17T10:00:00.000Z"
}
```

### Page\<T\>
```json
{ "items": [T], "page": 1, "limit": 12, "total": 37, "hasMore": true }
```

## 4. Endpoint Summary
| # | Method | Path | Access | Description | Traces |
|---|--------|------|--------|-------------|--------|
| E1 | `GET` | `/health` | Public | Check that the API and database are up | — |
| E2 | `GET` | `/destinations/search` | Public | Destination suggestions | F1, BR17 |
| E3 | `GET` | `/destinations/{destinationId}/places` | Public | Places of interest | F5, AC3.x |
| E4 | `POST` | `/trips` | Public | Create a trip (or copy a published plan) | F1, F10, F12 |
| E5 | `GET` | `/trips/{token}` | Any code | Get the trip as the caller's role | F2, F3, F9 |
| E6 | `PATCH` | `/trips/{token}` | Organiser | Edit name, destination or dates | F8, BR5–6 |
| E7 | `DELETE` | `/trips/{token}` | Organiser | Delete the trip (also how a delete request is approved) | F7, BR14 |
| E8 | `POST` | `/trips/{token}/publish` | Organiser | Publish | F4, BR15 |
| E9 | `POST` | `/trips/{token}/unpublish` | Organiser | Un-publish | F4, BR15 |
| E10 | `PUT` | `/trips/{token}/days/{dayId}` | Organiser, Editor | Save a day's text (with version check) | F3, BR7 |
| E11 | `PUT` | `/trips/{token}/days/{dayId}/presence` | Organiser, Editor | "I'm editing" heartbeat | F3, BR10 |
| E12 | `DELETE` | `/trips/{token}/days/{dayId}/presence/{sessionId}` | Organiser, Editor | "I've stopped editing" | F3, BR10 |
| E13 | `POST` | `/trips/{token}/delete-requests` | Editor | Ask the organiser to delete the trip | F7, AC8.1 |
| E14 | `POST` | `/trips/{token}/delete-requests/dismiss` | Organiser | Dismiss all pending requests | F7, AC7.2 |
| E15 | `GET` | `/trips/published` | Public | Directory and earlier trips for a destination | F4, F6 |
| E16 | `GET` | `/trips/published/{slug}` | Public | A published trip, read-only | F4, F12 |
| E17 | `POST` | `/recover` | Public | Email the organiser links for an email address | F10, BR12 |

> **Routing note:** `/trips/published…` is registered **before** `/trips/{token}`. The word `published` can never be a valid code, because codes are always 43 characters long.

### 4.1 Role × Endpoint Matrix
"C" means the call is rejected with `409 TRIP_COMPLETED` once the trip is Completed.

| Endpoint | organiser | editor | viewer |
|----------|:-:|:-:|:-:|
| E5 Get trip | ✅ | ✅ | ✅ |
| E6 Edit trip | ✅ C | 403 | 403 |
| E7 Delete | ✅ | 403 | 403 |
| E8 / E9 Publish / Un-publish | ✅ | 403 | 403 |
| E10 Save day | ✅ C | ✅ C | 403 |
| E11 / E12 Presence | ✅ C | ✅ C | 403 |
| E13 Request deletion | 403 | ✅ | 403 |
| E14 Dismiss requests | ✅ | 403 | 403 |

## 5. Endpoint Details

### E1 `GET /health`
- **Auth:** None.
- **Success response:** `200 OK`
```json
{ "status": "ok", "db": "ok", "time": "2026-10-17T09:30:00.000Z" }
```
- **Error responses:** `503` with `{ "status": "degraded", "db": "error" }` (not the standard error shape; used only by monitoring).

---

### E2 `GET /destinations/search`
- **Description:** Asks Geoapify Autocomplete (`type=city`). Results are cached for 7 days per normalised query. Each result is **saved to `destinations`** (or updated if it already exists), so it has a stable `id` that can be passed to E4 (BR17).
- **Auth:** None.
- **Query params:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | Yes | 2–100 characters, trimmed |
| `limit` | int | No | 1–10, default 6 |

- **Success response:** `200 OK`
```json
{ "items": [Destination] }
```
`items` may be empty.
- **Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | `q` is missing, too short or too long |
| 429 | `RATE_LIMITED` | More than 60 per minute per IP |
| 503 | `PROVIDER_UNAVAILABLE` | Geoapify failed and nothing is cached |

---

### E3 `GET /destinations/{destinationId}/places`
- **Description:** Places of interest from Geoapify Places, cached for 7 days per destination. If Geoapify fails, an expired cache entry is returned with `stale: true` (backend §6).
- **Auth:** None.
- **Path params:**

| Name | Type | Description |
|------|------|-------------|
| `destinationId` | uuid | From E2 or from `trip.destination.id` |

- **Query params:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | int | No | 1–50, default 30 |

- **Success response:** `200 OK`
```json
{
  "items": [Place],
  "stale": false,
  "fetchedAt": "2026-10-15T08:00:00.000Z",
  "attribution": "Powered by Geoapify · © OpenStreetMap contributors"
}
```
The frontend **must show the `attribution` text** in the Places panel.
- **Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 404 | `NOT_FOUND` | Unknown `destinationId` |
| 503 | `PROVIDER_UNAVAILABLE` | Geoapify failed and nothing is cached at all |

---

### E4 `POST /trips`
- **Description:** Creates a **private** trip with one empty day for each date (BR5). If `organiserEmail` is given, the organiser link is emailed to it in the background (BR11). If `copyFromSlug` is given, the source trip's day text is copied by position (BR13).
- **Auth:** None.
- **Request body:**
```json
{
  "name": "Kyoto Winter 2026",
  "destinationId": "0192f0c4-7a1e-7c3a-9b2e-5d1f2a3b4c5d",
  "fromDate": "2026-12-05",
  "toDate": "2026-12-10",
  "organiserEmail": "me@example.com",
  "copyFromSlug": null
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | Yes | 3–80 characters after trimming and collapsing spaces; unique ignoring upper/lower case |
| `destinationId` | uuid | Yes | Must exist (taken from E2 results) |
| `fromDate` | date | Yes | Today (AoE) or later |
| `toDate` | date | Yes | On or after `fromDate`; `toDate − fromDate ≤ 59` |
| `organiserEmail` | string \| null | No | A valid email address, at most 254 characters. Only a hash is stored. |
| `copyFromSlug` | string \| null | No | Must be a **published** trip's current or old slug |

- **Success response:** `201 Created`
```json
{
  "trip": TripView,
  "access": Access,
  "emailSent": true
}
```
- `trip` is in the organiser's view, with all three codes in `links`.
- `emailSent` is `true` if the email was accepted for sending, `false` if sending failed (the trip is still created), and `null` if no email was given.
- **Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | A field breaks a rule; the field names are in `details.fields` |
| 404 | `NOT_FOUND` | `copyFromSlug` is unknown or not published |
| 409 | `TRIP_NAME_TAKEN` | The name is already used |
| 429 | `RATE_LIMITED` | More than 10 trips created per hour per IP |

Destination problems are reported as `400 VALIDATION_ERROR` on the `destinationId` field, not as `404`, so the form can show them under the field.

---

### E5 `GET /trips/{token}`
- **Description:** Returns the trip as seen by the role of the code. The frontend calls this every 10s while the browser tab is visible.
- **Auth:** Any of the three codes.
- **Request headers:**
  - `X-Session-Id` (recommended; leaves the caller out of `editors`).
  - `If-None-Match: <etag>` (optional; the ETag from the previous response).
- **Success response:** `200 OK`, with an `ETag: W/"<hash>"` header
```json
{ "trip": TripView, "access": Access }
```
- **Not modified:** `304 Not Modified` with no body, returned when `If-None-Match` matches the current ETag.
- **How the ETag works:**
  - The server builds the full response (for this role and session), then takes the first 16 bytes of its **SHA-256** hash, written in base64url, as a weak ETag.
  - Any change to the trip, its days, editing presence, delete requests or Completed status therefore changes the ETag automatically.
  - A `304` still runs the database query and counts as a request. It saves **bandwidth**, not requests.
- **Caching in the browser:** Responses stay `Cache-Control: no-store`. The **client** remembers the ETag and the last body itself (in the TanStack Query cache) and sets `If-None-Match` on each re-fetch. A `304` means the cached data is kept as it is.
- **Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 404 | `NOT_FOUND` | The code is unknown or badly formatted, or the trip was deleted |
| 429 | `RATE_LIMITED` | More than 300 reads per minute per IP |

---

### E6 `PATCH /trips/{token}`
- **Description:** The organiser edits the trip's name, destination or dates. Only the fields that are sent change. Day content follows its position (BR5).
- **Auth:** Organiser.
- **Request body:**
```json
{
  "version": 3,
  "name": "Kyoto & Nara Winter 2026",
  "destinationId": null,
  "fromDate": "2026-12-12",
  "toDate": "2026-12-15",
  "confirmRemoveDays": false
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `version` | int | Yes | The `trip.version` that was last loaded |
| `name` | string | No | Same rules as E4 |
| `destinationId` | uuid | No | Same rules as E4 |
| `fromDate`, `toDate` | date | No | Same rules as E4, checked against the resulting pair of dates. If only one is sent, it is combined with the existing other date. |
| `confirmRemoveDays` | boolean | No (default `false`) | Must be `true` to remove days that have text |

At least one of `name`, `destinationId`, `fromDate` or `toDate` must be sent.

- **Success response:** `200 OK`
```json
{ "trip": TripView, "access": Access }
```
- `trip.version` goes up by 1.
- If the name changed, the `slug` changes too, and the old slug is saved for redirects (BR3).
- **Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | A field breaks a rule, or no fields to change were sent |
| 403 | `FORBIDDEN` | Not the organiser |
| 404 | `NOT_FOUND` | Unknown code |
| 409 | `TRIP_COMPLETED` | The trip is Completed |
| 409 | `TRIP_VERSION_CONFLICT` | `version` is out of date; `details.current` holds the latest trip |
| 409 | `TRIP_NAME_TAKEN` | The new name is already used |
| 409 | `DAYS_WOULD_BE_REMOVED` | Days with text would be removed and `confirmRemoveDays` isn't `true`; they are listed in `details.removedDays` |

---

### E7 `DELETE /trips/{token}`
- **Description:** Deletes the trip, its days, presence rows, delete requests and slug history for good. Afterwards, all three codes return `404`. This is also how a delete request is **approved**.
- **Auth:** Organiser. Allowed on Completed trips.
- **Success response:** `204 No Content`
- **Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 403 | `FORBIDDEN` | Not the organiser |
| 404 | `NOT_FOUND` | Unknown code |

---

### E8 `POST /trips/{token}/publish` · E9 `POST /trips/{token}/unpublish`
- **Description:** Sets `isPublished` to `true` or `false`. Calling it again has no further effect. Publishing sets `publishedAt` to the current time; un-publishing keeps the last `publishedAt` internally but returns `null`.
- **Auth:** Organiser. Allowed on Completed trips.
- **Request body:** none.
- **Success response:** `200 OK`
```json
{ "status": TripStatus }
```
- **Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 403 | `FORBIDDEN` | Not the organiser |
| 404 | `NOT_FOUND` | Unknown code |

---

### E10 `PUT /trips/{token}/days/{dayId}`
- **Description:** Saves a day's full text, using the version check (BR7). The frontend's autosave calls this.
- **Auth:** Organiser or Editor.
- **Path params:**

| Name | Type | Description |
|------|------|-------------|
| `dayId` | uuid | Must belong to the trip the code opens |

- **Request body:**
```json
{ "text": "Arrive KIX 14:00\n• Fushimi Inari Taisha (Sight)", "version": 3, "editorName": "Asha" }
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `text` | string | Yes | At most 5,000 characters after NFC normalisation; control characters other than `\n` and `\t` are removed; `""` is allowed |
| `version` | int | Yes | The `day.version` that was last loaded |
| `editorName` | string | Yes | 1–40 characters, trimmed |

- **Success response:** `200 OK`
```json
{ "day": Day }
```
`version` goes up by 1, and `updatedByName` and `updatedAt` are set.
- **Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Text too long, or a field is missing |
| 403 | `FORBIDDEN` | The code is a viewer code |
| 404 | `NOT_FOUND` | Unknown code, or the `dayId` isn't part of this trip |
| 409 | `TRIP_COMPLETED` | The trip is Completed |
| 409 | `DAY_VERSION_CONFLICT` | `version` is out of date; `details.current` holds the latest day |
| 429 | `RATE_LIMITED` | More than 120 writes per minute per IP |

---

### E11 `PUT /trips/{token}/days/{dayId}/presence`
- **Description:** "I'm editing this day" heartbeat. Sent when the text box gets focus and every 15s after that. Records `last_seen_at` for the session (BR10).
- **Auth:** Organiser or Editor.
- **Request body:**
```json
{ "sessionId": "t9Qw2xLr7Pz1", "editorName": "Asha" }
```
`sessionId`: 8–64 characters (it should match the `X-Session-Id` header). `editorName`: 1–40 characters.
- **Success response:** `204 No Content`
- **Error responses:** `400`, `403` (viewer), `404`, `409 TRIP_COMPLETED`, `429` (more than 20 per minute per IP). The client **ignores** these errors (frontend-spec §9).

### E12 `DELETE /trips/{token}/days/{dayId}/presence/{sessionId}`
- **Description:** "I've stopped editing", sent when the text box loses focus. Calling it again, or for a session that doesn't exist, still returns `204`.
- **Auth:** Organiser or Editor.
- **Success response:** `204 No Content`
- **Error responses:** `403`, `404`, `409 TRIP_COMPLETED`. Clients ignore them; the presence row expires after 30s anyway.

---

### E13 `POST /trips/{token}/delete-requests`
- **Description:** A traveller asks the organiser to delete the trip. Nothing is deleted. Each call adds a new pending request (QB8).
- **Auth:** Editor only. Allowed on Completed trips.
- **Request body:**
```json
{ "requestedByName": "Ravi" }
```
`requestedByName`: 1–40 characters.
- **Success response:** `201 Created`
```json
{ "deleteRequest": DeleteRequest }
```
- **Error responses:** `400`, `403` (organiser or viewer), `404`, `429`.

### E14 `POST /trips/{token}/delete-requests/dismiss`
- **Description:** Dismisses **all** pending delete requests (AC7.2). To approve instead, use E7.
- **Auth:** Organiser. Allowed on Completed trips.
- **Request body:** none.
- **Success response:** `200 OK`
```json
{ "dismissedCount": 3 }
```
- **Error responses:** `403`, `404`.

---

### E15 `GET /trips/published`
- **Description:** The published trips directory (F4). With `destinationId`, it gives the earlier trips to that destination (F6). Only trips with `isPublished = true` are ever included.
- **Auth:** None.
- **Query params:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | No | 2–100 characters; matches the trip name or destination name, ignoring upper/lower case |
| `destinationId` | uuid | No | Only trips to this destination |
| `excludeSlug` | string | No | Leaves out this trip (the current one) |
| `page`, `limit` | int | No | See §1 |

- **Success response:** `200 OK`
```json
Page<TripSummary>
```
Sorted by `publishedAt` descending.
- **Error responses:** `400` (bad parameters), `429`.

### E16 `GET /trips/published/{slug}`
- **Description:** A published trip, read-only. It also works with an **old slug** from before a rename; `canonicalSlug` then gives the current one (AC5.3). It is used for `/explore/:slug` and to pre-fill a copy (`/new?from=:slug`).
- **Auth:** None.
- **Success response:** `200 OK`
```json
{ "trip": PublicTripView, "access": Access }
```
`access.role` is `public`, and only `canCopyPlan` is `true`.
- **Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 404 | `NOT_FOUND` | Unknown slug, or the trip isn't published (private trips give the same response as missing ones) |

---

### E17 `POST /recover`
- **Description:** Emails the organiser links for every trip linked to this email (BR11–BR12). **The response is the same whether or not any trips match.** The email is sent in the background.
- **Auth:** None.
- **Request body:**
```json
{ "email": "me@example.com" }
```
- **Success response:** `202 Accepted`
```json
{ "message": "If we have trips for this email, we've sent the links." }
```
- **Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | The email is missing or not valid |
| 429 | `RATE_LIMITED` | More than 3 per hour for this email, or more than 10 per hour per IP |

## 6. Example Flows
1. **Create and share:** E2 (`q=kyo`) → E4 → the frontend opens `/o/{organiserToken}?created=1` and shows the codes from `trip.links`.
2. **Edit together:**
   - Each browser calls E5 every 10s.
   - Focusing a day calls E11, then E11 again every 15s.
   - About 1s after typing stops, E10 saves with `version`.
   - Leaving the text box calls E12.
   - If E10 returns `409 DAY_VERSION_CONFLICT`, the frontend shows the `ConflictPanel` using `details.current`.
   - **Keep mine** sends E10 again with `version = details.current.version`.
3. **Shorten dates:** E6 (`confirmRemoveDays: false`) → `409 DAYS_WOULD_BE_REMOVED` → the frontend shows `ShrinkDatesConfirm` → E6 again with `confirmRemoveDays: true`.
4. **Delete request:** An editor calls E13. The organiser's E5 now includes it in `pendingDeleteRequests`. The organiser then calls either E7 (approve) or E14 (dismiss all).
5. **Copy a plan:** E16 (`slug`) → the frontend pre-fills `/new` → E4 with `copyFromSlug`.
6. **Recover:** E17 → an email is sent with links to `{APP_PUBLIC_URL}/o/{organiserToken}`.

## 7. Decision Log
| # | Question | Decision |
|---|----------|----------|
| QA1 | Where do codes go in API calls? | **In the path** (`/trips/{token}/…`). Our logs record only the route pattern; Cloudflare's own logs may still contain full URLs, which is acceptable for the MVP. |
| QA2 | Should the 10-second re-fetch support `304 Not Modified`? | **Yes, in v1.** E5 returns a weak `ETag` built from a hash of the response; the client sends `If-None-Match`. |
| QA3 | What status does an edit on a Completed trip get? | **`409 TRIP_COMPLETED`.** |

## 8. Open Questions
- None at present.

## 9. Changelog
| Version | Date | Change |
|---------|------|--------|
| 0.1 | 2026-10-17 | First draft. 17 endpoints, shared data types and error codes, matching goal v0.5, frontend v0.2 and backend v0.2. |
| 0.2 | 2026-10-17 | Decisions QA1–QA3: codes go in the path; ETag and 304 on E5; `409 TRIP_COMPLETED`. |
