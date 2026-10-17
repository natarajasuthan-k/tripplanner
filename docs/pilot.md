# Pilot plan (Phase 3)

Goal-spec §12, Phase 3: deploy to free hosting, test with real groups for **3 months**, and fix what we learn. The success metrics come from goal-spec §11.

## Before inviting anyone

- [ ] [docs/deployment.md](deployment.md) steps 1–8 are done, and `/health` is all `ok`.
- [ ] An uptime monitor is set up on `/health`.
- [ ] You have restored one backup on a Neon branch, so you know restoring works.
- [ ] A feedback channel exists: a shared form, a WhatsApp group or an email address. Put the link in the invite message.
- [ ] Test trips from step 8 are deleted.

## Who

Two to four real groups planning **upcoming** trips, with at least one group of four or more people. Mix phone and laptop users. Each group's organiser creates the trip themselves.

## What to ask each group to try

1. The organiser creates the trip, **with their email**, and shares the edit link in the group chat.
2. Everyone opens the link and adds at least one idea to some day.
3. Use the Ideas panel to add a place.
4. Share the view-only link with someone who isn't travelling.
5. After the trip, optionally publish it.
6. Bonus: someone tries "Forgot my link" on another device.

## Known issues going into the pilot

- **Beaches rarely appear among suggested places** (decided 2026-10-17 to leave for now). Geoapify returns them (e.g. 4 for Chennai, 2 for Mumbai), but a beach without a Wikipedia/Wikidata entry scores below the many vaguely tagged "attractions" such as roadside statues, so it misses the top 30. Notable large parks (e.g. Guindy National Park) can also be missing, because cities have hundreds of parks and Geoapify returns them in no useful order. Proposed fix when we pick it up: weight beaches 6, give vaguely tagged items the lowest weight, request `national_park` separately, and log a category breakdown to tune from real data. Users can still type any place into a day.
- **Organiser-link emails only reach the Resend account owner** until a domain is verified and `EMAIL_FROM` is switched (docs/deployment.md, step 3).

## What to measure (goal-spec §11)

Run these read-only queries in the Neon SQL editor.

| Metric                           | Target       | How                                                     |
| -------------------------------- | ------------ | ------------------------------------------------------- |
| Create and share in ≤ 1 minute   | ≤ 1 min      | Watch one organiser do it, or ask in the feedback form. |
| Trips edited by 2 or more people | ≥ 80%        | Query C                                                 |
| Places used from suggestions     | ≥ 1 per trip | Query A                                                 |
| Data-loss incidents              | 0            | Feedback, plus the error logs (5xx on day saves)        |
| Hosting cost                     | $0           | Billing pages of Cloudflare, Neon, Resend and Geoapify  |

**Query A: trips that used at least one suggested place.** "Add to plan" inserts lines starting with `•`.

```sql
select count(distinct trip_id) as trips_with_places,
       (select count(*) from trips) as trips
from days where text like '%•%';
```

**Query B: activity overview.**

```sql
select count(*) as trips,
       count(*) filter (where is_published) as published,
       count(*) filter (where organiser_email_hash is not null) as with_recovery_email,
       count(*) filter (where copied_from_trip_id is not null) as copies
from trips;
```

> **How contributors are counted (goal Q25):** each day save records a one-way hash of the trip and the editor's display name in `trip_contributors`; names are never stored there. Two people using the same name count once, so Query C is a slight under-count.

**Query C: share of trips edited by 2 or more people.**

```sql
select round(100.0 * count(*) filter (where contributors >= 2) / nullif(count(*), 0), 1)
         as pct_trips_with_2plus,
       count(*) as trips_with_any_edit
from (select trip_id, count(*) as contributors from trip_contributors group by trip_id) t;
```

## Weekly routine (about 15 minutes)

- [ ] `/health` history is clean in the uptime monitor.
- [ ] Workers logs show no unusual 5xx or 429 responses.
- [ ] Usage is comfortably under the free-plan limits (Workers requests, Geoapify credits, Resend emails).
- [ ] The latest **Backup** run succeeded.
- [ ] New feedback has been read and triaged into GitHub issues.

## Feedback form, suggested questions

1. How long did it take to create and share the trip? (under 1 min / 1–3 min / longer)
2. How many people in your group added something?
3. Was anything confusing? (links, autosave, conflicts, publishing)
4. Did you ever lose text, or see "Not saved"?
5. Did you use the suggested places? Were they useful?
6. What would make you use this for your next trip?

## End of pilot: go / no-go

- **Go** for a wider launch if the targets are met, there was no data loss, and costs stayed at $0.
- Otherwise, write the findings into the specs (goal-spec Decision Log) and plan the fixes as the next phase.
