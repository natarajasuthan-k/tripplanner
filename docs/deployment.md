# Deployment runbook

How to take Trip Planner from this repository to a live, free-tier deployment (goal-spec §12, Phase 3; backend-spec §12).

```
 Browser ──► Cloudflare Worker (web, static assets) tripplanner.<you>.workers.dev
    │
    └─────► Cloudflare Workers (API)                tripplanner-api.<you>.workers.dev
               ├─► Neon (Postgres 18)
               ├─► Geoapify (destinations, places)
               └─► Resend (organiser-link emails)

 GitHub Actions: CI → Deploy (migrate → API → web → smoke test); weekly encrypted backup
```

Everything below costs **$0** on the free plans. Check the current free-plan limits when you sign up (see [Limits](#free-plan-limits)).

> **Who does what:** the steps that create accounts, sign in or handle keys must be done by you, the account owner. Everything else is automated in the repository.

---

## 1. Neon (database)

1. Create a Neon account and a project. The default Postgres version (18 at the time of writing) is fine. Choose the region closest to your users, e.g. _Asia Pacific (Singapore)_ for India.
   - Local development and CI use Postgres 17 in Docker. The schema works on both. The Backup workflow installs whichever `pg_dump` matches the server.
2. Copy the connection string for the default database. It looks like `postgres://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
3. Keep it safe. It is used as the `DATABASE_URL` secret in steps 5 and 6.

## 2. Geoapify (destination search and places)

1. Create a Geoapify account and a project, then copy its **API key**.
2. It is used as the `GEOAPIFY_API_KEY` Worker secret (step 5). The Worker calls Geoapify server-side, so the key never reaches browsers.

## 3. Resend (email)

1. Create a Resend account.
2. **Add and verify a domain you own.** Add the DNS records Resend shows you (SPF/DKIM) at your domain registrar.
   - Without a verified domain, Resend only delivers to your own account address, so pilot users would not receive their organiser links.
3. Create an API key with _Sending access_. It is used as the `RESEND_API_KEY` secret (step 5).
4. In `apps/api/wrangler.jsonc` → `env.production.vars`, set `EMAIL_FROM`, e.g. `"Trip Planner <links@yourdomain.com>"`.

## 4. Cloudflare (hosting)

1. Create a Cloudflare account. Note the **Account ID** (dashboard → Workers & Pages → right sidebar).
2. The web app is a **Worker with static assets** named `tripplanner` (`apps/web/wrangler.jsonc`). You can create it from the dashboard (Workers & Pages → Create → upload a placeholder), or let the first deploy create it.
   - Your app URL is `https://tripplanner.<your-subdomain>.workers.dev`. The API Worker is `tripplanner-api.<your-subdomain>.workers.dev`.
3. In `apps/api/wrangler.jsonc` → `env.production.vars`, set **both** `APP_PUBLIC_URL` and `CORS_ORIGIN` to the app URL, with no trailing slash. Commit the change.
4. Create an **API token**: My Profile → API Tokens → _Create token_ → template **Edit Cloudflare Workers**. That template covers both Workers. Copy the token.

## 5. Worker secrets

On your machine, in `apps/api`:

```bash
corepack pnpm exec wrangler login
```

Then set each secret. Wrangler prompts for the value, so it never lands in your shell history.

```bash
corepack pnpm exec wrangler secret put DATABASE_URL --env production
```

```bash
corepack pnpm exec wrangler secret put GEOAPIFY_API_KEY --env production
```

```bash
corepack pnpm exec wrangler secret put RESEND_API_KEY --env production
```

```bash
corepack pnpm exec wrangler secret put EMAIL_HMAC_SECRET --env production
```

For `EMAIL_HMAC_SECRET`, generate a long random value:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> ⚠️ **Store `EMAIL_HMAC_SECRET` in your password manager.** If it changes, "Forgot my link" can no longer find existing trips (backend-spec §9).

If you deploy before the secrets are set, the Worker refuses requests and `/health` reports `"config": "error"`. That is intentional: production never runs with fake providers, missing keys or a placeholder secret.

## 6. GitHub (CI/CD)

In the repository → Settings → Environments → create **`production`**, then add:

| Kind     | Name                    | Value                                                                            |
| -------- | ----------------------- | -------------------------------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`  | token from step 4                                                                |
| Secret   | `CLOUDFLARE_ACCOUNT_ID` | account ID from step 4                                                           |
| Secret   | `DATABASE_URL`          | Neon connection string (used for migrations and backups)                         |
| Secret   | `BACKUP_PASSPHRASE`     | a long random passphrase. **Keep a copy**: backups can't be restored without it. |
| Variable | `API_BASE_URL`          | `https://tripplanner-api.<your-subdomain>.workers.dev/api/v1`                    |
| Variable | `APP_URL`               | `https://tripplanner.<your-subdomain>.workers.dev`                               |

Your workers.dev subdomain is shown in the Cloudflare dashboard (Workers & Pages → Overview).

## 7. First deploy

1. Merge the release branch into `main`.
2. **CI** runs: format, lint, typecheck, unit/integration tests, builds, then end-to-end tests. When it succeeds, **Deploy** runs:
   1. `pnpm db:migrate` against Neon. Migrations only add things.
   2. `wrangler deploy --env production` (API).
   3. Build the web app against `API_BASE_URL`, then `wrangler pages deploy` (web).
   4. Smoke test: `/health` must return `{"status":"ok","db":"ok","config":"ok"}`, and the app must serve a CSP header.
3. You can also run **Deploy** manually: Actions → Deploy → _Run workflow_.

## 8. Verify by hand (15 minutes)

- [ ] Open the app on a phone and create a trip **with your email**. The organiser-link email arrives (check spam).
- [ ] Destination search returns real cities, and the Ideas panel shows real places.
- [ ] Open the edit link on another device, enter a name and edit a day. The first device shows it within about 10s.
- [ ] Both people edit the same day: the editing indicator appears, and a conflict offers Keep mine / Use theirs.
- [ ] Publish the trip, find it under Explore in a private window, open it and copy it.
- [ ] "Forgot my link" emails the organiser link.
- [ ] Delete the test trips.

## Operations

**Logs.** Use Cloudflare dashboard → Workers → tripplanner-api → Logs, or run:

```bash
corepack pnpm exec wrangler tail --env production
```

Logs contain route patterns, statuses and timings. Access codes, emails and day text are never logged.

**Health.** `GET {API_BASE_URL}/health`. Point a free uptime monitor (for example UptimeRobot) at it.

**Rollback.**

- API: Cloudflare dashboard → Workers → Deployments → roll back, or run `wrangler rollback --env production`.
- Web: Cloudflare dashboard → Workers → tripplanner → Deployments → roll back, or `wrangler rollback` in `apps/web`.
- Database: migrations only add things, so the previous Worker version keeps working against the newer schema.

**Backups.** The **Backup** workflow runs every Monday. It also runs on demand. Each backup is a `pg_dump`, encrypted with `BACKUP_PASSPHRASE` and kept as a workflow artifact for 35 days. Neon's own point-in-time restore covers shorter windows.

To restore, try it on a **Neon branch** first:

```bash
gpg --decrypt tripplanner-YYYYMMDDTHHMMSSZ.dump.gpg > restore.dump
```

```bash
pg_restore --clean --if-exists --no-owner --dbname "$BRANCH_DATABASE_URL" restore.dump
```

## Free-plan limits

These were the figures when the specs were written; check them again when you sign up.

| Service            | Limit (approx.)                       | What users see when it's exceeded                                                         |
| ------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Cloudflare Workers | 100k requests/day                     | API errors until the daily reset. A trip open by 5 people uses about 1,800 requests/hour. |
| Neon               | 0.5 GB storage; compute auto-suspends | A short delay on the first request after idle                                             |
| Geoapify           | 3,000 credits/day                     | Destination search and places say "unavailable"; cached results keep working              |
| Resend             | 100 emails/day, 3,000/month           | `emailSent: false`. The share dialog tells the organiser to copy the link.                |
| GitHub Actions     | 2,000 min/month on private repos      | CI and deploys pause                                                                      |

## Optional: custom domain

Add a custom domain to the `tripplanner` Worker, and optionally to `tripplanner-api`, e.g. `api.yourdomain.com` (Workers → Settings → Domains & Routes). Then update `APP_PUBLIC_URL`, `CORS_ORIGIN`, `API_BASE_URL` and `APP_URL`, and redeploy.
