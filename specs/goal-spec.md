# Goal Spec — Trip Planner

> The "why" and "what" of the product. Every other spec must trace back to this one.
>
> **Status:** v0.5 — goal, frontend and backend questions resolved (see §13 Decision Log). Items still marked *(proposed)* have not been explicitly confirmed.

## 1. Overview
Trip Planner is a lightweight, mobile-friendly web app where a group of travellers plan a trip together in one shared place. An organiser creates a trip (destination and dates) and shares links: an **edit link** for fellow travellers and an optional **view-only link** for anyone else. People with the edit link add and change day-by-day plans. While planning, the app suggests places of interest for the destination and shows earlier published trips to the same place for inspiration.

## 2. Problem Statement
When several people plan a trip together, their ideas end up spread across chat threads, notes and spreadsheets. That makes them hard to consolidate, track and agree on. Today, groups cope by having one person collect everything by hand, which is slow and loses information.

Trip Planner keeps every trip detail in one place. Everyone opens it through a shared link, with no sign-up needed, so the whole group contributes to the same plan.

## 3. Target Users / Personas
| Persona | Description | Access | Primary Needs |
|---------|-------------|--------|---------------|
| Organiser | Creates the trip and shares the links. Owns the trip. | Organiser link (recoverable by email) | Create a trip, edit the plan, publish or delete the trip, handle delete requests, get the organiser link back if it's lost |
| Traveller | Fellow traveller who adds input. | Edit link | View and edit day plans, add suggested places, invite others, ask for the trip to be deleted |
| Viewer | Someone who needs to see the plan but not change it (family, friends). | View-only link | See the trip read-only |
| Visitor | Anyone browsing published trips for ideas. | Published directory | Browse published trips and see their plans read-only |

## 4. Goals
- [ ] **G1:** Let an organiser create a trip with a unique name, a destination and a date range in under 1 minute.
- [ ] **G2:** Let the trip be shared through links that anyone can open without creating an account, with separate edit and view-only access.
- [ ] **G3:** Let the organiser and travellers add and change day-level plans on an existing trip.
- [ ] **G4:** Help planning by suggesting places of interest and earlier trips for the chosen destination.

## 5. Non-Goals (Out of Scope for MVP)
- User accounts, passwords or social sign-in (access is by link only)
- Booking flights, hotels or activities, and payments
- Expense tracking or splitting costs
- Live co-editing (Google Docs-style cursors and character-by-character sync). Others' saved edits and "is editing" indicators show up within about 10s, by checking the server regularly (F3).
- Email notifications about activity, SMS or push notifications. Delete requests are shown inside the app only. **The only email sent is the organiser-link email (F10).**
- Native mobile apps (the responsive web app covers mobile)
- Offline mode
- Maps with routes or directions
- Several languages (English only)
- Trips with more than one destination

## 6. Core Features (MVP)
| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| F1 | Trip creation | Create a trip with a **Trip Name** (3–80 characters, unique across the app, ignoring upper/lower case), an optional **Organiser Email** (F10), a **Destination** picked from a suggestion list, a **From Date** (today or later) and a **To Date** (on or after the From Date, at most 60 days in total). New trips are **private**: they can be reached only through their links. | Must |
| F2 | Link-based access | Creating a trip produces three links, each containing a long random code that can't be guessed. **Organiser link:** full control (edit, publish, delete, handle delete requests). **Edit link:** view and edit day details, see and copy the edit and view-only links to invite others, ask for deletion. **View-only link:** read-only. The organiser link is only ever shown to the organiser. Editors enter a display name, which is remembered on their device, so that edits show who made them. | Must |
| F3 | Day-level trip details | The trip is split into one entry per day, generated from the date range. Each day has a free-text field (up to 5,000 characters). Organisers and travellers can add and change details on any day. **Changes save automatically** shortly after typing stops, with a visible "Saving… / Saved" status. While someone is editing a day, others see a **"‹name› is editing…"** message. It is a soft warning: they can still edit. If someone else saved the same day since you started, your save is held back and you choose which version to keep. | Must |
| F4 | Published trips directory | The organiser can **publish** or **un-publish** a trip. Everyone can browse all published trips, search them, and open one to see its plan read-only. | Must |
| F5 | Destination suggestions | When a destination is chosen, fetch places of interest from a trusted, well-known source with a free tier and show them in a side panel. Users who can edit add a suggestion to a chosen day with one click. | Must |
| F6 | Earlier trips for a destination | When a destination is chosen, list earlier **published** trips to the same destination for inspiration. | Should |
| F7 | Trip deletion & delete requests | The organiser can delete a trip. A traveller (edit link) can only *ask* for deletion. The request appears to the organiser inside the app, and the organiser approves or dismisses it. | Must |
| F8 | Edit trip | The organiser can change the trip's name, destination and dates. If shortening the dates would remove days that have content, the organiser sees those days and must confirm before they are deleted. | Should |
| F9 | Trip completion | Once the To Date has passed, the trip is automatically labelled **Completed** and its details become **read-only** for everyone. The organiser can still publish, un-publish and delete it. Completed trips are kept until the organiser deletes them. | Should |
| F10 | Organiser email & link recovery | When creating a trip, the organiser can **optionally** give an email address. If they do, the organiser link is emailed to them. A **"Forgot my link"** page sends the organiser links for every trip linked to an email address. The email is used for nothing else. | Should |
| F11 | Trips on this device | The browser remembers the trips opened on it (name, role, link) and lists them as "Your trips on this device". Nothing extra is stored on the server. | Should |
| F12 | Copy a published plan | A published trip has a **"Copy this plan"** button. It opens the create form with the destination filled in. After the user enters a new name and dates, a new **private** trip is created, with the original's day details copied over in order. | Should |
| F13 | Onboarding & help | The app explains itself, since there are no accounts: (a) a **"How it works"** section on Home (create, share, plan together, publish) with a short explanation of the three links; (b) a full **`/how-it-works`** guide covering features, roles, the three links and a FAQ (lost link, Completed trips, privacy); (c) **first-visit tips** the first time someone opens a trip in each role, which they can close and which don't come back. | Should |

## 7. User Stories
| ID | Story | Features |
|----|-------|----------|
| US1 | As an **organiser**, I want to create a new trip, so that I can enter trip details and share them with fellow travellers. | F1, F2 |
| US2 | As a **traveller**, I want to view and change the trip details, so that I can add my suggestions for the group. | F2, F3 |
| US3 | As an **organiser or traveller**, I want to see places of interest for the destination, so that I can add good options to the plan quickly. | F5 |
| US4 | As an **organiser**, I want to see earlier trips to the same destination, so that I can reuse ideas. | F6 |
| US5 | As an **organiser**, I want to publish my trip, so that others can find it and get inspired. | F4 |
| US6 | As a **visitor**, I want to browse published trips and look into a trip's plan, so that I can get ideas for my own trip. | F4 |
| US7 | As an **organiser**, I want to delete my trip or act on a traveller's delete request, so that I stay in control of the trip. | F7 |
| US8 | As a **traveller**, I want to ask for the trip to be deleted, so that the organiser knows the trip is no longer needed. | F7 |
| US9 | As a **viewer**, I want to open a view-only link, so that I can follow the plan without changing it by accident. | F2 |
| US10 | As an **organiser**, I want to change the trip's dates or destination, so that the plan matches what changed. | F8 |
| US11 | As an **organiser**, I want finished trips to be marked Completed, so that the record of what we did stays as it was. | F9 |
| US12 | As an **organiser**, I want to get my organiser link back by email, so that I don't lose control of my trip if I lose the link. | F10 |
| US13 | As an **organiser or traveller**, I want to see the trips I've opened on this device, so that I can get back to them without searching for links. | F11 |
| US14 | As a **visitor**, I want to copy a published trip's plan into a new trip, so that I can start from a proven itinerary. | F12 |
| US15 | As a **traveller**, I want my edits saved automatically and to see when someone else is editing a day, so that I don't lose work or clash with others. | F3 |
| US16 | As a **first-time user** (any role), I want to understand how the app and its links work, so that I use the right link and don't share the organiser link by mistake. | F13 |

## 8. Acceptance Criteria

### US1 — Create trip
- **AC1.1** Given the create-trip form, when the organiser submits a name, destination, From Date and To Date, then the trip is created as **private**, and the organiser link, edit link and view-only link are shown, each labelled and with a copy button.
- **AC1.2** Given a From Date earlier than today, when the form is submitted, then a validation error says the From Date must be today or later.
- **AC1.3** Given a To Date earlier than the From Date, when the form is submitted, then a validation error says the To Date must be on or after the From Date. A one-day trip, where both dates are the same, is allowed.
- **AC1.4** Given a date range longer than 60 days, when the form is submitted, then a validation error says a trip can be at most 60 days.
- **AC1.5** Given a trip name already in use by any trip (ignoring upper/lower case), when the form is submitted, then a validation error asks for a different name.
- **AC1.6** Given any required field is empty, when the form is submitted, then the form is not sent and the empty field is highlighted.
- **AC1.7** Given a trip is created, when it opens, then there is one empty day entry for each date from the From Date to the To Date.

### US2 — View / modify trip details
- **AC2.1** Given a valid edit link, when a traveller opens it, then the trip name, destination, dates and every day's details are shown and can be edited.
- **AC2.2** Given a traveller opens a trip for the first time on a device, when they first try to edit, then they are asked for a display name, which is stored on that device.
- **AC2.3** Given a traveller edits a day's free text, when they stop typing for about 1 second or leave the field, then the change is saved automatically. Others with the trip open see the new text and "last edited by &lt;name&gt; at &lt;time&gt;" within about 10 seconds, without reloading.
- **AC2.4** Given someone else saved a change to the same day after this person started editing, when this person's change is about to save, then automatic saving pauses for that day, both versions are shown, and they choose **Keep mine** (overwrite) or **Use theirs**. Their text is not lost until they decide.
- **AC2.6** Given a user is editing a day, when someone else views the trip, then that day shows "‹name› is editing…" within about 10 seconds. Others can still edit (soft warning). The message disappears about 30 seconds after the editor stops.
- **AC2.7** Given an automatic save fails (network or server error), when it fails, then the day shows "Not saved — Retry", the text is kept on the device, and nothing is lost.
- **AC2.8** Given an editor, when they open the share dialog, then they can copy the edit link and the view-only link but never see the organiser link.
- **AC2.5** Given a link that is invalid or belongs to a deleted trip, when it is opened, then a "Trip not found" page is shown.

### US3 — Destination suggestions
- **AC3.1** Given a destination is chosen, when the trip page loads, then a side panel lists places of interest (name, type, short description, link to the source).
- **AC3.2** Given a user with edit access and a place of interest in the list, when they click "Add to plan" and pick a day, then the place is added to that day's details.
- **AC3.3** Given the suggestion source is slow or unavailable, when the page loads, then the trip still loads normally and the panel shows "Suggestions unavailable".

### US4 — Earlier trips for destination
- **AC4.1** Given a destination is chosen, when the organiser looks at the create or trip page, then earlier **published** trips to the same destination are listed (name, dates), newest first. Private trips are never listed.
- **AC4.2** Given no earlier published trips exist for the destination, when the list loads, then the message "No earlier trips yet" is shown.

### US5 / US6 — Publish & browse
- **AC5.1** Given the organiser link, when the organiser publishes the trip, then it appears in the published trips directory.
- **AC5.2** Given the organiser link, when the organiser un-publishes the trip, then it is removed from the directory but all three links still work.
- **AC5.3** Given a published trip is renamed, when someone opens its old public address, then they are redirected to the new one.
- **AC6.1** Given the published trips directory, when a visitor opens it, then all published trips are listed and can be searched by destination or name.
- **AC6.2** Given a published trip in the directory, when a visitor opens it, then they see its plan read-only. Its edit and organiser links are never shown.

### US7 / US8 — Delete & delete requests
- **AC7.1** Given the organiser link, when the organiser deletes the trip and confirms, then the trip and all its details are removed, and all links show "Trip not found" from then on.
- **AC7.2** Given one or more pending delete requests, when the organiser opens the organiser link, then a banner shows who asked and when (e.g. "Asha and 2 others asked to delete this trip"), with **Approve (delete)** and **Dismiss all** buttons.
- **AC7.3** Given a delete request is already pending, when another traveller asks for deletion, then their request is also recorded and added to the banner.
- **AC8.1** Given the edit link, when a traveller clicks "Request deletion", then no data is deleted, a delete request is recorded and shown to the organiser (see AC7.2), and the traveller sees "Request sent to organiser".
- **AC8.2** Given the view-only link or the published directory, when the trip is shown, then there is no delete or request-deletion option.

### US9 — View-only link
- **AC9.1** Given a view-only link, when it is opened, then the full plan is shown with no edit controls, no "Add to plan" buttons and no request-deletion option.
- **AC9.2** Given a view-only link, when someone sends an edit request directly to the server, then it is rejected.

### US10 — Edit trip
- **AC10.1** Given the organiser link, when the organiser changes the name, destination or dates, then the same rules as AC1.2–AC1.5 apply.
- **AC10.2** Given the date range is shortened and some removed days have content, when the organiser saves, then the days with content are listed and they are deleted only after the organiser confirms.
- **AC10.3** Given the date range is extended, when the organiser saves, then empty day entries are added for the new dates.
- **AC10.4** Given the trip is moved to different dates, when the organiser saves, then each day's details stay with its **day number** (Day 1 stays Day 1). Shortening removes days from the end.

### US11 — Trip completion
- **AC11.1** Given a trip whose To Date is before today, when it is opened through any link, then it is labelled **Completed** and all day details are read-only.
- **AC11.2** Given a Completed trip, when the organiser opens the organiser link, then publish, un-publish and delete still work, but editing the trip and day details does not.

### US12 — Organiser email & recovery
- **AC12.1** Given the create form, when the organiser leaves the email empty, then the trip is still created (the email is optional).
- **AC12.2** Given an email that isn't in a valid format, when the form is submitted, then a validation error is shown.
- **AC12.3** Given a valid email, when the trip is created, then an email containing the trip name and the organiser link is sent to that address.
- **AC12.4** Given the "Forgot my link" page, when any email is submitted, then the page always says "If we have trips for this email, we've sent the links". If trips exist, one email lists the organiser links for all of them. The page never reveals whether the address is known.
- **AC12.5** Given a recovery request, when the same email asks again within a short time, then sending is limited (about 3 per hour).

### US13 — Trips on this device
- **AC13.1** Given a user has opened or created trips on this device, when they visit Home, then "Your trips on this device" lists each one with its name, role and an Open button, most recent first.
- **AC13.2** Given a trip in the list has since been deleted, when it is opened, then "Trip not found" is shown and the user can remove it from the list.
- **AC13.3** Given the list, when the user clicks "Remove", then the trip is removed from this device's list only.

### US14 — Copy a published plan
- **AC14.1** Given a published trip, when a visitor clicks "Copy this plan", then the create form opens with the destination filled in and a number of days that matches the original.
- **AC14.2** Given the user submits valid name and dates, when the trip is created, then it is **private**, and day *n* of the new trip gets the details of day *n* of the original.
- **AC14.3** Given the new date range is shorter than the original, when the form is shown, then it warns how many of the original's days will not be copied.
- **AC14.4** Given a copied trip, when it is created, then it has new links and keeps no connection to the original (later changes to one don't affect the other).

### US16 — Onboarding & help
- **AC16.1** Given Home, when it loads, then a "How it works" section shows the main steps and explains what the organiser, edit and view-only links each allow, with a link to `/how-it-works`.
- **AC16.2** Given any page, when the user clicks "How it works" in the top bar, then the full guide opens, with sections on features, roles and links, and a FAQ.
- **AC16.3** Given someone opens a trip in a role (organiser, editor or viewer) for the first time on this device, when the page loads, then a closable tip explains what they can do in that role. The organiser tip warns them to keep the organiser link private and suggests adding a recovery email.
- **AC16.4** Given a tip has been closed, when the same role is opened again on this device, then the tip is not shown again. The guide page has a "Show tips again" option that brings them back.

## 9. Constraints & Assumptions
- **Tech stack preferences:** None fixed. Prefer a modern, lightweight stack that runs on free hosting. To be decided in `frontend-spec.md` and `backend-spec.md`.
- **Hosting / deployment:** Must run on **free-tier** hosting for an initial **3 months**. Avoid services that charge once a free trial or free credits run out.
- **Budget / timeline:** For a small group of users. Tight budget (near zero) and a short timeline, so keep the MVP scope lean.
- **Third-party services:** The place-of-interest source (F5) and the destination suggestion list (F1) must come from a trusted, well-known provider with a free tier. Chosen provider: **Geoapify** (Autocomplete + Places). Emails for F10 are sent through **Resend**. Hosting: **Cloudflare Workers + Pages**, with **Neon Postgres** as the database (see `backend-spec.md`).
- **Architecture:** A **separate frontend single-page app** on free static hosting, plus a **separate backend API**. The two are tied together only by `api-contract-spec.md`.
- **Assumptions:**
  - Travellers trust each other. Anyone with the edit link may edit.
  - Each trip has one destination.
  - Destinations are picked from a suggestion list rather than typed freely, so that "earlier trips for the same destination" (F6) can match reliably.
  - Dates use the calendar date of the destination. Times of day are not tracked in the MVP.
  - A trip counts as Completed from the day after its To Date.

## 10. Non-Functional Requirements
- **Usability / UI:** Modern, clean and lightweight. Works on mobile and desktop (responsive from 360px screen width upwards).
- **Performance:** The first page shows its main content in under **2.5s** on a typical 4G phone. Saving an edit responds in under **500ms** (not counting cold starts on free hosting). Destination suggestions load in the background and never hold up the page.
- **Security / Privacy:**
  - All three links contain long random codes (at least 128 bits) that can't be guessed, and are unrelated to each other. Neither the edit link nor the view-only link reveals the organiser link.
  - Permissions are checked **on the server** for every request, not just hidden in the interface.
  - Only HTTPS. All free text is cleaned before display to prevent script injection (XSS).
  - Personal data collected: a display name, and an **optional organiser email**. The email is used only to send organiser links (F10). It is never shown in the app or returned by any API, and it is deleted when the trip is deleted. No passwords are stored.
  - Limits on request rates for creating and editing trips, to prevent abuse.
- **Accessibility:** Aim for WCAG 2.1 AA basics: everything usable by keyboard, labelled form fields, enough colour contrast.
- **Scalability:** MVP target is about 100 trips and about 20 people using it at once. The design should not block moving to paid hosting and a larger database later, for a mass-market launch.
- **Browser / device support:** The two latest versions of Chrome, Edge, Firefox and Safari, plus iOS Safari and Android Chrome.
- **Reliability:** Saved trip data must not be lost when the free-tier server restarts, so the database must be persistent.

## 11. Success Metrics *(proposed)*
- An organiser can create and share a trip in **≤ 1 minute**.
- **≥ 80%** of created trips get edits from **2 or more** distinct contributors.
- Each trip uses **≥ 1** place of interest from the suggestions.
- **Zero** data-loss incidents during the 3-month pilot.
- Hosting cost stays at **$0** for the pilot.

## 12. Milestones / Phases *(proposed)*
| Phase | Scope | Target Date |
|-------|-------|-------------|
| 0 | Finish all four specs (goal, frontend, backend, API contract) | TBD |
| 1 — Core MVP | F1 Create, F2 Links (organiser / edit / view-only), F3 Day details (autosave + editing indicator), F7 Delete & requests, F11 Trips on this device, F13 Onboarding & help | TBD |
| 2 — Discovery | F5 Destination suggestions, F4 Published directory, F6 Earlier trips, F8 Edit trip, F9 Completion, F10 Email recovery, F12 Copy plan | TBD |
| 3 — Pilot | Deploy to free hosting, test with a real group, fix issues | TBD (runs 3 months) |
| Later | Accounts, several destinations, live co-editing, maps, notifications, mass-market scaling | — |

## 13. Decision Log
| # | Question | Decision |
|---|----------|----------|
| Q1 | How is the organiser told apart from travellers without accounts? | A private **organiser link**, separate from the links given to others. |
| Q2 | Should a new trip be published by default? | No. Trips are **private (link only)** until the organiser publishes them. |
| Q3 | Are one-day trips allowed? | **Yes**: To Date ≥ From Date. |
| Q4 | Is there a limit on trip length? | **60 days** at most. |
| Q5 | What happens to day details if the dates are shortened? | **Warn and confirm**: list the days with content that would be removed, and delete them only after confirmation. |
| Q6 | How unique must trip names be? | **Across the whole app**, ignoring upper/lower case. |
| Q7 | Can the organiser keep some people from editing? | **Yes, with a separate view-only link**, giving three links: organiser, edit and view-only. |
| Q8 | How are two people editing the same day at once handled? | **Warn on save**: show the newer version and let the user overwrite or cancel. No live co-editing. |
| Q9 | What happens to trips after they end? | They are **labelled Completed and become read-only**. The organiser can still publish, un-publish and delete them. They are kept until deleted. |
| Q10 | Which provider supplies destination suggestions and places of interest? | **Decided in `backend-spec.md`.** It must have a free tier. |
| Q11 | Separate frontend and backend, or one full-stack framework? | **Separate single-page app plus API.** |
| Q12 | How does an organiser recover a lost organiser link? | **Remembered on the device (F11) and email recovery (F10).** Giving an email is optional. |
| Q13 | Should delete requests also be emailed to the organiser? | **No.** Email is used only for organiser-link recovery. Delete requests stay in the app. |
| Q14 | Who can see and copy the share links? | **The organiser and editors** (edit and view-only links). Only the organiser sees the organiser link. |
| Q15 | How are day details saved? | **Automatically, plus a "‹name› is editing…" indicator.** |
| Q16 | What happens when someone else is already editing a day? | **Soft warning only.** No locking; conflicts are caught by the version check. |
| Q17 | Length limits? | Trip name **3–80** characters; day text up to **5,000** characters. |
| Q18 | Can a published plan be copied into a new trip? | **Yes (F12).** The new trip is private, and days are copied in order. |
| Q19 | How does the app explain its features and the three links? | **A "How it works" section on Home, a full `/how-it-works` guide, and first-visit tips for each role** (F13). |
| Q20 | Should the organiser have one page listing all their trips? | **No separate page.** "Your trips on this device" (F11) serves as the hub, and email recovery (F10) covers other devices. The landing page for everyone is **Home (`/`)**; the organiser page opens only through the organiser link. |
| Q21 | When the dates change, does day content follow day number or calendar date? | **Day number** (AC10.4). |
| Q22 | Several delete requests on one trip? | **Keep them all.** The organiser sees every request and can Approve (delete) or Dismiss all (AC7.2–7.3). |
| Q23 | What happens to a published trip's address after a rename? | **The address changes, and the old one redirects** (AC5.3). |

## 14. Open Questions
- None at present.
