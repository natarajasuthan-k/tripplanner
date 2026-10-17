# Frontend Spec — Trip Planner

> How the user-facing app looks and behaves. Traces to features in `goal-spec.md` (F#, US#, AC#); consumes endpoints in `api-contract-spec.md`.
>
> **Status:** v0.2 — open questions resolved (see §12 Decision Log). Items still marked *(proposed)* are defaults that have not been explicitly confirmed.

## 1. Tech Stack
**Architecture:** A separate **React single-page app (SPA)** talking to a separate backend API (goal-spec Q11).

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | **React 19** SPA | Widely used. The app is a static bundle, so it can be hosted free on any CDN. |
| Language | **TypeScript** (strict mode) | Type safety. The API types can be shared with or generated from the API contract. |
| Build tool | **Vite** | Fast development server and small production bundles. |
| Routing | **React Router v8** (library mode, `createBrowserRouter`) | Simple client-side routes; routes are loaded on demand. |
| Server state | **TanStack Query** | Caching, regular refreshing from the server, and loading/error states. |
| Client state | React state + Context (no Redux) | There is very little global state (display name, theme, toasts). |
| Styling | **Tailwind CSS v4** | Lightweight and quick to build with; dark mode support built in. |
| UI primitives | **Radix UI** (dialogs, popovers, toasts, tabs) | Accessible building blocks with no styling of their own. |
| Icons | **lucide-react** | Light; only the icons used are bundled. |
| Forms / validation | **React Hook Form + Zod** | Zod rules can be shared with the backend if it's also TypeScript. |
| Dates | **date-fns** + native `<input type="date">` | Native date pickers are the most usable on mobile. |
| Testing | **Vitest + React Testing Library + MSW** (fake API); **Playwright** (end-to-end) | See §11. |
| Hosting | **Cloudflare Pages** (free plan) | Meets the free-hosting constraint. Every unknown path serves the app so client routes work. |

## 2. Pages / Routes
Access is by link only (no sign-in). The secret code in the URL decides what the person can do. The server works out the person's role, and the UI follows it (§6).

| Route | Page | Access | Purpose | Features |
|-------|------|--------|---------|----------|
| `/` | Home | Public | What the app is; create and browse buttons; **Your trips on this device**; recent published trips | F1, F4, F11 |
| `/new` | Create Trip | Public | Trip creation form | F1, F6, F10 |
| `/new?from=:slug` | Create Trip (copy) | Public | Create form pre-filled from a published trip | F12 |
| `/o/:organiserToken` | Trip (Organiser) | Organiser link | Full control | F2–F9 |
| `/e/:editToken` | Trip (Editor) | Edit link | View and edit days; share the links; ask for deletion | F2, F3, F5, F7 |
| `/v/:viewToken` | Trip (Viewer) | View-only link | Read-only plan | F2 |
| `/explore` | Published Trips | Public | Browse and search published trips | F4 |
| `/explore/:slug` | Published Trip | Public | Read-only plan of a published trip; "Copy this plan" | F4, F12 |
| `/recover` | Forgot My Link | Public | Ask for organiser links to be emailed | F10 |
| `/how-it-works` | How It Works | Public | Full guide: features, roles, the three links, FAQ | F13 |
| `*` | Not Found | Public | Unknown route, invalid link or deleted trip | AC2.5 |

> **Home (`/`) is the landing page for everyone.** The organiser page opens only through the organiser link: right after creating a trip, or from the device list, the recovery email or a bookmark. There is no separate "my trips" page; **"Your trips on this device" on Home serves as the organiser's hub** (goal-spec Q20).
>
> The four Trip routes all use **one `TripPage` component** in different modes. A published trip is opened through its public `slug`, made from its unique name. Its view-only code is never used for this, so the directory never reveals any of the trip's links.

## 3. Page Details

### 3.1 Home (`/`)
- **Purpose:** Get people started quickly (G1) and help them find their trips again (F11).
- **Layout:** From top to bottom:
  - A hero section with "Plan a trip" (goes to `/new`) and "Browse trips" (goes to `/explore`).
  - **Your trips on this device**: a list of name, role badge, last opened date, **Open** and **Remove** (AC13.1–13.3). Hidden if the list is empty.
  - **How it works** (AC16.1), using `HowItWorksSteps`:
    - Four steps: ① Create a trip → ② Share the links → ③ Plan together → ④ Publish for inspiration.
    - A **"Three links" explainer** with three small cards:
      - 🔑 **Organiser:** full control, keep it private.
      - ✏️ **Edit:** for fellow travellers.
      - 👁 **View-only:** for family and friends.
    - A "Read the full guide" button that goes to `/how-it-works`.
  - **Recently published**: up to 6 `TripCard`s.
  - A footer with links to "Lost your organiser link?" (`/recover`) and "How it works".
- **Data:** `GET /trips/published?limit=6`; the device list comes from `tp.myTrips` in browser storage.
- **States:** If there are no published trips, hide that section. If the API fails, the hero and the device list still show.

### 3.2 Create Trip (`/new`, `/new?from=:slug`)
- **Purpose:** F1, F10, F12; US1, US12, US14.
- **Layout:** One-column form with these fields:
  - Trip Name
  - Destination (search box with suggestions)
  - From Date, To Date
  - **Organiser email (optional)**, with the help text "We'll email you the organiser link so you never lose it. Used for nothing else."
  - The Create button.

  On desktop, once a destination is picked, an "Earlier trips to this destination" panel appears next to the form (F6, AC4.1).
- **Copy mode (`?from=:slug`):**
  - A banner at the top: "Copying the plan from ‹trip name›".
  - The destination is filled in from the original, and the dates are set to the same number of days starting today (AC14.1).
  - If the chosen range is shorter than the original, a warning says "‹n› days from the original won't be copied" (AC14.3).
- **Data:** `GET /destinations/search?q=` (waits 300ms after typing stops, needs at least 2 characters); `GET /trips/published?destinationId=`; `GET /trips/published/:slug` (in copy mode); `POST /trips` (with `copyFromSlug` in copy mode).
- **User actions:** Fill in and submit the form. On success:
  1. Add the trip to `tp.myTrips` as organiser.
  2. Go to `/o/:organiserToken?created=1`, which opens the **Share Links dialog** straight away (AC1.1).
  3. If an email was given, the dialog also says "We've emailed the organiser link to ‹email›".
- **States:** Errors appear under each field (§7). The Create button shows a spinner and is disabled while saving. If the name is already taken (`409`), the error appears under Trip Name (AC1.5).

### 3.3 Trip Page (`/o/…`, `/e/…`, `/v/…`, `/explore/:slug`)
- **Purpose:** The main workspace (F3, F5, F7, F8, F9, F12).
- **On load:** Add or update the trip in `tp.myTrips` (name, role, code, last opened). This is skipped on `/explore/:slug`, which uses no code.
- **Layout (desktop ≥ 1024px):** Two columns.
  - **Header:** Trip name, destination, date range, number of days, badges for the trip's state (`Private` / `Published`, `Completed`, `View only`). Action buttons depend on the role (§6). On `/explore/:slug` there is a **Copy this plan** button.
  - **Main column (about ⅔ width):** One `DayCard` per day, in date order.
  - **Side panel (about ⅓ width, stays in view while scrolling):** Two tabs, **Places** (F5) and **Earlier trips** (F6).
- **Layout (mobile < 1024px):** One column. Two tabs at the top switch between **Plan** and **Ideas**; Ideas holds the side panel content.
- **First-visit tip (AC16.3–16.4):** The first time a role is opened on this device, a closable `RoleTip` appears under the header:
  - **Organiser:** "You're the organiser. Use **Share** to invite travellers (edit link) or viewers (view-only link). Keep *this* link private — it controls the trip." If no recovery email is set, it adds: "We'll keep it on this device; enter an email when creating your next trip to recover it anywhere." *(proposed)*
  - **Editor:** "You can edit any day — changes save automatically. Use **Share** to invite others."
  - **Viewer:** "This is a read-only view of the plan."

  Closing the tip records the role in `tp.tipsSeen`.
- **Banners (top of the page):**
  - Organiser + pending delete requests: "‹name› asked to delete this trip on ‹date›", or "‹name› and ‹n› others asked…" with a popover listing every name and date. Buttons: **Approve (delete)** and **Dismiss all** (AC7.2–7.3).
  - Completed: "This trip has ended and is now read-only" (AC11.1).
  - Viewer: "You're viewing this trip read-only" (AC9.1).
- **Keeping in sync (AC2.3, AC2.6):**
  - While the browser tab is visible, the trip is re-fetched **every 10s**. This updates other people's saved text and the "is editing" indicators.
  - The page uses regular re-fetching only, with no live connection (works on free hosting).
- **Old public addresses (AC5.3):** If `GET /trips/published/:slug` returns a `canonicalSlug` that differs from the slug in the URL, the page replaces the URL with `/explore/:canonicalSlug` without adding a history entry.
- **Data:** `GET /trips/:token` (or `GET /trips/published/:slug`), which returns the trip, its days (including each day's `version` and `editors`), the person's `role` and `permissions`; `GET /destinations/:id/places` (loaded in the background); `GET /trips/published?destinationId=`.
- **User actions by role:** See §6 Permission Matrix.
- **States:**
  - Loading: placeholder outlines of the header and 3 day cards.
  - `404`: show the Not Found page, and offer to remove the trip from this device's list (AC2.5, AC13.2).
  - Places failing: the panel shows "Suggestions unavailable" with a Retry button. The rest of the page is unaffected (AC3.3).
  - No earlier trips: "No earlier trips yet" (AC4.2).

### 3.4 Day editing — autosave & editing indicator (F3, US15)
How each `DayCard` behaves when someone edits it:

1. **Editing:** The day text is always editable for people who are allowed to edit; there's no separate edit mode. When the text box gets focus, the browser sends `PUT …/days/:dayId/presence` straight away and then **every 15s** while focus stays. When focus leaves, it sends `DELETE …/presence/:sessionId`. Every trip request carries the tab's `X-Session-Id` header, so the user's own presence is left out of the editors list. The server forgets an editor it hasn't heard from in **30s** (AC2.6).
2. **Autosave:** The change is saved **1s after typing stops**, and also when the text box loses focus. It is sent as `PUT …/days/:dayId` with the `version` that was last loaded. Only one save per day is in progress at a time; changes made during a save are sent once it finishes.
3. **Save status** (next to the day, announced to screen readers through `aria-live`): `Saving…`, then `Saved ✓`, or `Not saved — Retry` (AC2.7).
4. **Saving locally while typing:** The text is also saved on the device (`tp.draft.<dayId>`) as the user types, and cleared after a successful save. After a reload, an unsaved draft is offered back: "Restore unsaved text?"
5. **Editing indicator:** If the latest trip data lists other editors on a day, that day shows "‹name› is editing…" (or "‹name› and 1 other…"). This is a **soft warning**: editing is still allowed (goal-spec Q16).
6. **Updates from others:**
   - **No unsaved changes here:** The new text replaces the current text quietly. The cursor position is kept where possible.
   - **Unsaved changes here:** The newer version is held back, and the conflict check below takes over.
7. **Conflict (`409`, AC2.4):** Automatic saving **pauses** for that day. An inline `ConflictPanel` shows "‹name› saved a newer version" with the two versions side by side, and **Keep mine** (sends the change again against the latest version) or **Use theirs** (throws away the local text). There is also a **Copy mine** button, so the user can copy their text before choosing. Automatic saving resumes after the choice.
8. **Completed or view-only:** The text box is read-only. No presence messages or saves are sent.

### 3.5 Published Trips (`/explore`)
- **Purpose:** F4, US6.
- **Layout:** A search box (matches destination or name, waits 300ms after typing stops) above a responsive grid of `TripCard`s: 1 column on mobile, 2 on tablet, 3 on desktop. Newest first. A "Load more" button fetches the next page.
- **Data:** `GET /trips/published?q=&page=`.
- **States:** If the search finds nothing, show "No trips match ‹q›". If nothing is published at all, show "No published trips yet — be the first!" with a button to `/new`.

### 3.6 Forgot My Link (`/recover`)
- **Purpose:** F10, US12.
- **Layout:** An email field and a "Send my links" button.
- **Data:** `POST /recover`.
- **After submit:** Whatever happens, show the same message: "If we have trips for this email, we've sent the links. Check your inbox (and spam)." (AC12.4). If the server answers `429`, show "Please wait before trying again" (AC12.5).

### 3.7 How It Works (`/how-it-works`)
- **Purpose:** F13, US16; AC16.2.
- **Layout:** A static page made of sections, with a list of section links at the top. It needs no API calls.
  1. **What Trip Planner does:** One paragraph and a short list of the features.
  2. **The three links:** A table of what each link allows (a simplified version of the §6 Permission Matrix), and who to share each one with.
  3. **Planning together:** How autosave works, the "is editing" indicator, and what happens when two people edit the same day.
  4. **Ideas & inspiration:** Places of interest, earlier trips, and copying a published plan.
  5. **Publishing & privacy:** Private vs published trips, what visitors see, and that the email is used only for recovery.
  6. **When a trip ends:** Completed trips become read-only.
  7. **FAQ:** "I lost my organiser link", "Can I stop someone editing?" (give them the view-only link), "How do I delete a trip?", "Is my data private?"
  8. **Show tips again:** A button that clears `tp.tipsSeen` (AC16.4).
- **Content source:** Plain text built into the page. No content management system.

### 3.8 Not Found (`*`)
- Message "Trip not found — the link may be wrong or the trip was deleted", with buttons to the Home page and to create a trip. If the code is in `tp.myTrips`, a "Remove from my trips" button is also shown.

## 4. Component Inventory
| Component | Description | Key Props | Used In |
|-----------|-------------|-----------|---------|
| `AppShell` | Top bar (logo, Explore, How it works, New trip, `ThemeToggle`), main content area, holder for toasts | `children` | All |
| `HowItWorksSteps` | The four-step section and the three-link cards | `compact?` | Home, How It Works |
| `RoleTip` | Closable tip for the person's role on their first visit | `role`, `hasRecoveryEmail` | Trip Page |
| `ThemeToggle` | Switch between System, Light and Dark | — | AppShell |
| `TripForm` | Name, destination, dates and optional email fields with validation; used to create, copy and edit | `mode: 'create'\|'copy'\|'edit'`, `defaultValues`, `sourceDayCount?`, `onSubmit` | Create Trip, Edit Trip Dialog |
| `DestinationAutocomplete` | Accessible search box with suggestions; returns `{id, name, country, lat, lon}` | `value`, `onChange` | TripForm |
| `TripHeader` | Name, destination, dates, status badges, buttons allowed for the role | `trip`, `permissions` | Trip Page |
| `DayCard` | One day: date label, `DayEditor`, `SaveStatus`, `PresenceIndicator`, "last edited by ‹name› at ‹time›", and `ConflictPanel` when needed | `day`, `canEdit`, `token` | Trip Page |
| `DayEditor` | Text box that grows with its content, with a character count (up to 5,000). It runs autosave (1s pause), sends editing heartbeats and keeps a draft on the device. | `value`, `onChange`, `onFocus`, `onBlur`, `readOnly` | DayCard |
| `SaveStatus` | Shows Saving… / Saved ✓ / Not saved — Retry, announced to screen readers | `state`, `onRetry` | DayCard |
| `PresenceIndicator` | "‹name› is editing…" | `editors` | DayCard |
| `ConflictPanel` | Inline panel comparing **yours** with **the latest**; Keep mine / Use theirs / Copy mine | `mine`, `latest`, `onResolve` | DayCard (AC2.4) |
| `SidePanel` | Places / Earlier trips tabs; on mobile, the content of the Ideas tab | `destinationId`, `canEdit`, `days` | Trip Page |
| `PlaceList` / `PlaceItem` | List of places of interest (name, type, short description, source link) and the provider credit (`attribution`) required by the API; "Add to plan" button | `places`, `canEdit`, `onAdd` | SidePanel (AC3.1–3.2) |
| `AddToDayPopover` | Lets the user pick which day a place is added to | `days`, `onPick` | PlaceItem |
| `EarlierTripsList` | Small cards for published trips to the same destination | `destinationId`, `excludeSlug` | SidePanel, Create Trip |
| `TripCard` | Card for a published trip (name, destination, dates, number of days) | `trip` | Home, Explore |
| `MyTripsList` | The trips saved on this device, with Open and Remove | — | Home |
| `CopyPlanButton` | Goes to `/new?from=:slug` | `slug` | Published Trip header |
| `ShareLinksDialog` | Edit link and view-only link, each with Copy and native Share buttons. **Organiser only:** the organiser link with a "keep private" warning, and a note if a recovery email is set. | `links`, `role` | Trip Page (organiser, editor) |
| `DisplayNamePrompt` | Dialog asking for a display name on the first edit; saves it on the device | `onSubmit` | Trip Page (AC2.2) |
| `RecoverForm` | Email field and submit, with the same message whatever happens | — | Forgot My Link |
| `ConfirmDialog` | General confirmation dialog, with an optional warning style for destructive actions | `title`, `body`, `confirmLabel`, `destructive` | Delete, Publish, shrinking dates |
| `ShrinkDatesConfirm` | Lists the days with content that would be removed | `removedDays` | Edit Trip Dialog (AC10.2) |
| `Banner` | Message strip across the page, in info, warning or action style | `variant`, `children`, `actions` | Trip Page, Create (copy mode) |
| `StatusBadge` | Private / Published / Completed / View only | `status` | TripHeader, TripCard |
| `Toaster` | Short pop-up messages (Radix Toast) | — | AppShell |
| `EmptyState`, `ErrorState`, `Skeleton` | Shared views for empty, error and loading content | `title`, `action` | All |

## 5. State & Data Flow
- **Global state (Context):**
  - `DisplayNameContext`: the display name, read from and saved to browser storage.
  - `ThemeContext`: `system | light | dark`, saved on the device. It adds or removes the `dark` class on `<html>`.
  - Toasts, through the Radix Toast provider.
- **Server state (TanStack Query):**
  | Query key | Source | Refresh |
  |-----------|--------|---------|
  | `['trip', token]` | `GET /trips/:token` | **Every 10s while the browser tab is visible**; also when the tab regains focus. Sends `If-None-Match` with the last `ETag`; on `304` the cached data stays as it is (API E5). |
  | `['published', {q, page, destinationId}]` | `GET /trips/published` | Considered fresh for 60s |
  | `['publishedTrip', slug]` | `GET /trips/published/:slug` | Considered fresh for 60s |
  | `['places', destinationId]` | `GET /destinations/:id/places` | Considered fresh for 24h (place data rarely changes) |
  | `['destinations', q]` | `GET /destinations/search` | Considered fresh for 10m |
- **Changes (mutations):** create or copy a trip, update the trip, save a day, update or clear editing presence, publish or un-publish, delete, request deletion, approve or dismiss a request, recover links.
  - Day saves are written straight into the matching day in the `['trip', token]` cache, using the day returned by the server. They are **not** optimistic (the page waits for the server).
  - Other changes refresh `['trip', token]` and, where relevant, `['published']`.
- **Optimistic concurrency (AC2.4):** Each day carries a `version`. A save sends that version. A `409` reply includes the latest version and opens `ConflictPanel` (§3.4).
- **Merging re-fetched data with local edits:** When the trip is re-fetched, a day the user hasn't changed takes the server text straight away. For a day with unsaved changes, the local text is kept, and the conflict check handles it when the save goes out.
- **Persisted on the device (browser storage, all wrapped in try/catch):**
  | Key | Contents |
  |-----|----------|
  | `tp.displayName` | string |
  | `tp.theme` | `system \| light \| dark` |
  | `tp.myTrips` | `[{name, role, token, lastOpenedAt}]`, most recently opened first, up to 50 (F11) |
  | `tp.draft.<dayId>` | `{text, baseVersion, savedAt}`, cleared after a successful save |
  | `tp.tipsSeen` | `('organiser' \| 'editor' \| 'viewer')[]`, the roles whose first-visit tip has been closed |

## 6. Access & Permissions (Client Side)
There are no accounts. The **code in the URL is the credential.**

- **Login / signup:** None. The organiser can get a lost organiser link back by email (`/recover`) or from "Your trips on this device".
- **Token handling:** The code is read from the route and sent to the API with every request (the exact format, header or path, is set in `api-contract-spec.md`). Codes are also saved in `tp.myTrips` on the device (F11).
- **Avoiding code leaks:**
  - `<meta name="referrer" content="no-referrer">` is set across the site, so codes don't leak to outside place-of-interest links.
  - Outside links use `rel="noopener noreferrer"`.
  - Codes are never sent to analytics or error-reporting tools.
- **Role-driven UI:** The API returns the person's `role` (`organiser` | `editor` | `viewer` | `public`) and a `permissions` object. The UI **only hides or shows** controls based on these. The server still enforces every permission (AC9.2).
- **Expiry:** Codes don't expire. A deleted trip makes its codes return `404`, so the Not Found page is shown.

### Permission Matrix
| Action | Organiser | Editor | Viewer | Public (`/explore/:slug`) | When Completed |
|--------|:-:|:-:|:-:|:-:|---|
| View plan | ✅ | ✅ | ✅ | ✅ | Everyone can still view |
| Edit day details / Add to plan | ✅ | ✅ | ❌ | ❌ | ❌ for everyone |
| Edit trip (name, destination, dates) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Copy the edit and view-only links | ✅ | ✅ | ❌ | ❌ | Unchanged |
| See the organiser link | ✅ | ❌ | ❌ | ❌ | Unchanged |
| Publish / un-publish | ✅ | ❌ | ❌ | ❌ | ✅ organiser |
| Delete trip | ✅ | ❌ | ❌ | ❌ | ✅ organiser |
| Request deletion | — | ✅ | ❌ | ❌ | ✅ editor |
| Approve / dismiss request | ✅ | ❌ | ❌ | ❌ | ✅ organiser |
| Copy this plan | — | — | — | ✅ (published only) | ✅ |

## 7. Forms & Validation
The rules below mirror those in `goal-spec.md` §8. **The server checks them again**, and its answer is final.

| Form | Fields | Validation Rules | Submit Action |
|------|--------|------------------|---------------|
| Create Trip | `name`, `destination`, `fromDate`, `toDate`, `organiserEmail?` | `name`: required, extra spaces trimmed, **3–80 characters**; uniqueness checked by the server (`409`, AC1.5). `destination`: must be chosen from the suggestions, typed text alone is not accepted. `fromDate`: required, today or later in the user's local calendar (AC1.2). `toDate`: required, on or after `fromDate` (AC1.3). Range: at most 60 days including both ends (AC1.4). `organiserEmail`: optional; if given, must be a valid email, up to 254 characters (AC12.1–12.2). | `POST /trips`, then go to `/o/:token?created=1` |
| Copy Plan | Same as Create, plus the hidden `copyFromSlug` | Same rules. Shows a warning when the new range has fewer days than the original (AC14.3). | `POST /trips` with `copyFromSlug` |
| Edit Trip | `name`, `destination`, `fromDate`, `toDate` | Same rules (AC10.1). If the new range removes days that have content, the user must confirm in `ShrinkDatesConfirm` first (AC10.2). The email can't be changed here *(proposed)*. | `PATCH /trips/:token` |
| Day Details | `text` | Optional, up to **5,000 characters**; the counter turns amber at 4,500. Free text, shown as plain text with line breaks kept. **No raw HTML is ever rendered.** | Autosave: `PUT /trips/:token/days/:dayId` with `version` |
| Display Name | `displayName` | Required, 1–40 characters, extra spaces trimmed | Saved on the device; sent with edits and editing presence |
| Request Deletion | `displayName` (pre-filled) | Required | `POST /trips/:token/delete-requests` |
| Forgot My Link | `email` | Required, valid email | `POST /recover` |

- **Field errors** appear under the field, linked to it for screen readers (`aria-describedby`). Fields are checked when the user leaves them and again on submit. The first invalid field gets focus on submit (AC1.6).
- **"Add to plan"** adds a new line, `• ‹Place name› (‹type›)`, to the end of the chosen day's text. It saves straight away through the same version check.

## 8. UI / UX Guidelines
- **Design direction:** Clean, airy and modern. Mostly neutral colours with one accent colour; cards with soft rounded corners; generous white space.
- **Theme tokens *(proposed)*:** Accent `teal-600` (`teal-400` in dark mode); neutrals from Tailwind `slate`; red for danger, amber for warnings. Font: **Inter** (falls back to the system font), base size 16px.
- **Dark mode:** By default it **follows the system** light/dark setting, and the top bar has a **manual switch** (System / Light / Dark) that is saved in `tp.theme`.
  - Tailwind's `dark:` variant is driven by a `dark` class on `<html>`.
  - A small script in `index.html` applies the saved theme before the page first appears, so it doesn't flash the wrong theme.
- **Responsive breakpoints:** Tailwind defaults: `sm` 640, `md` 768, `lg` 1024 (where the side panel moves into its own column), `xl` 1280. Must work from **360px** wide.
- **Touch targets:** At least 44×44px on mobile.
- **Accessibility (WCAG 2.1 AA basics):**
  - Everything works with the keyboard, and focus is always clearly visible.
  - Radix primitives keep focus inside open dialogs.
  - The destination search box follows the ARIA combobox pattern.
  - Text colour contrast is at least 4.5:1 **in both themes**.
  - Day cards use `<article>`s with headings (`<h3>` = the date).
  - Save status, editing indicators and toasts are announced politely by screen readers (`aria-live="polite"`).
  - Animations are reduced when the user's system asks for it (`prefers-reduced-motion`).
- **Notifications:** Toasts for successes ("Link copied", "Trip published") and for errors that don't block the user. Day saving uses the inline save status, not toasts. Conflicts use the inline `ConflictPanel`. Destructive actions use dialogs.
- **Destructive actions:** Delete trip, approve deletion and shrinking the dates always ask for confirmation first, using red styling.
- **Leaving with unsaved text:** If a save is still waiting or has failed, the browser's "leave page?" warning appears (`beforeunload`), and in-app navigation is blocked too.
- **Performance budget:**
  - The first JavaScript download is under **150 KB gzipped**.
  - Each route is a separate code bundle, loaded only when needed.
  - The main content appears in under 2.5s on 4G.
  - The places panel never holds up the page.
  - Regular re-fetching stops while the browser tab is hidden.

## 9. Error Handling
| Situation | Behaviour |
|-----------|-----------|
| `400 VALIDATION_ERROR` | The server's errors (`error.details`) are shown under the matching fields |
| `404 NOT_FOUND` on a trip | Show the Not Found page and offer to remove the trip from this device's list |
| `403 FORBIDDEN` | Toast "You don't have permission to do that", then reload the trip to get the current permissions |
| `409 CONFLICT` (trip name) | Error under the Trip Name field |
| `409 CONFLICT` (day version) | Pause autosave for that day and show the `ConflictPanel` |
| `409 TRIP_COMPLETED` | Toast "This trip has ended and is read-only", then reload the trip; the text boxes become read-only |
| `429 RATE_LIMITED` | Toast "Too many requests — please wait a moment". Autosave waits longer before trying again. |
| `5xx` / network failure | Read requests retry twice with increasing delays. **Autosave** tries again after 2s, 5s and 10s, then shows `Not saved — Retry`; the draft stays on the device. Failed editing-presence messages are ignored. |
| Free-tier cold start (slow first request) | After 3s of waiting, show "Waking up the server…" |
| Offline | A strip says "You're offline". Autosave pauses (drafts are still kept on the device) and resumes when the connection returns. |
| Unexpected crash | A safety net around each page (React error boundary) shows "Something went wrong" with a Reload button |

## 10. Environment & Config
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Base URL of the backend API | `https://api.tripplanner.example/api/v1` |
| `VITE_APP_NAME` | Name shown in the interface and the page title | `Trip Planner` |

- Share links are built in the browser from `window.location.origin` plus the route and code.
- The links in emails are built **by the backend**, which needs its own setting for the app's public address (see `backend-spec.md`).
- The provider API keys for destinations, places and email **stay on the backend**. The frontend never contains them.

## 11. Testing Strategy
- **Unit (Vitest):** Date range checks (past dates, same day, at most 60 days), the Zod schemas, generating the list of days, working out which days a shrink would remove, the "Add to plan" text format, how many days a copy can include, the autosave timing and save-queue logic, merging re-fetched data with local edits, the `tp.myTrips` list (most recent first, maximum 50).
- **Component (React Testing Library + MSW fake API):**
  - `TripForm` errors, including the optional email and copy mode
  - `DayCard` autosave, retry after failure, and `ConflictPanel` after a `409`
  - `PresenceIndicator`
  - The permission matrix (each role shows the right controls)
  - Places panel loading, error and empty states
  - `ThemeToggle`
  - `RecoverForm` shows the same message whatever the reply
  - `RoleTip` shows once per role and comes back after "Show tips again"
- **End-to-end (Playwright, against a local backend with test data):** One test per acceptance-criteria group:
  - Create (with email), then get links, then edit as an editor, then view as a viewer (AC1.x, AC2.x, AC9.1, AC12.3)
  - Two browsers: the editing indicator appears; editing at the same time produces a conflict that is resolved both ways (AC2.4, AC2.6)
  - Autosave survives a network drop (AC2.7)
  - Publish, find it in Explore, open it read-only, then copy the plan (AC5–6, AC14)
  - Delete request, then the organiser approves, then the links show Not Found (AC7–8, AC13.2)
  - Shrinking dates with confirmation (AC10.2)
  - A Completed trip is read-only (AC11)
  - The recover flow (AC12.4)
  - Run on desktop Chrome and on a phone-sized screen (Pixel and iPhone emulation), in both light and dark themes.
- **Accessibility:** `axe-core` checks inside the Playwright tests for each page, in both themes.
- **CI:** Type checking, lint, unit and component tests on every push; end-to-end tests on the main branch.

## 12. Decision Log
| # | Question | Decision |
|---|----------|----------|
| Q-F1 | Remember trips opened on this device? | **Yes** (F11), **plus optional email recovery** (F10). |
| Q-F1a | Email delete requests to the organiser too? | **No.** Email is used only for organiser-link recovery. |
| Q-F2 | Who can see and copy the share links? | **The organiser and editors** (edit and view-only links). Only the organiser sees the organiser link. |
| Q-F3 | Autosave or an explicit Save button? | **Autosave plus a "‹name› is editing…" indicator** (§3.4). |
| Q-F3a | Lock a day while someone else edits it? | **No, a soft warning only.** The version check catches conflicts. |
| Q-F4 | Separate SPA, or one full-stack framework? | **Separate React SPA plus API.** |
| Q-F5 | Dark mode? | **Follow the system setting, plus a manual switch.** |
| Q-F6 | Length limits? | Trip name **3–80** characters; day text up to **5,000**. |
| Q-F7 | "Copy this plan" on published trips? | **Yes** (F12). |
| Q-F8 | How does the app explain itself? | **A "How it works" section on Home, a `/how-it-works` guide, and first-visit tips for each role** (F13). |
| Q-F9 | A separate page listing all of an organiser's trips? | **No.** Home is the landing page; "Your trips on this device" serves as the hub. |
| Q-F10 | Hosting for the frontend? | **Cloudflare Pages**, the same provider as the API on Workers (backend QB1). |

## 13. Open Questions
- None at present. API details are defined in `api-contract-spec.md` (E1–E17).
