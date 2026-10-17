# Trip Planner

Plan trips together: one shared plan, no sign-up, just links. Built spec-first. Every feature traces back to [`specs/`](specs/).

| Spec                                               | What's in it                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| [goal-spec.md](specs/goal-spec.md)                 | Product goals, features (F#), user stories (US#) and acceptance criteria (AC#) |
| [frontend-spec.md](specs/frontend-spec.md)         | Pages, components, state, UX, testing                                          |
| [backend-spec.md](specs/backend-spec.md)           | Data model, business rules (BR#), security, deployment                         |
| [api-contract-spec.md](specs/api-contract-spec.md) | Endpoints E1–E17, schemas and error codes. Both sides must follow it.          |

## Repository layout

```
apps/
  web/        React 19 SPA (Vite, Tailwind v4, React Router, TanStack Query) → Cloudflare Pages
  api/        Hono API on Cloudflare Workers (Drizzle ORM, Postgres)
packages/
  shared/     Zod schemas, limits, error codes, date/text rules, permission matrix
specs/        The four specs
```

## Prerequisites

- Node 22+ (see `.nvmrc`)
- pnpm 10, through corepack: `corepack enable` (or prefix commands with `corepack pnpm`)
- Docker Desktop, for local Postgres

## Getting started

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # then fill in the secrets
pnpm db:up          # Postgres 17 on localhost:5432
pnpm db:migrate     # apply migrations
pnpm dev            # API on :8787, web on :5173 (requests to /api are forwarded to the API)
```

Open http://localhost:5173. The API health check is at http://localhost:8787/api/v1/health, and the OpenAPI document is at `/api/v1/openapi.json`.

## Scripts (run from the repo root)

| Script                             | Does                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| `pnpm dev` / `dev:api` / `dev:web` | Run the local dev servers                             |
| `pnpm test`                        | Vitest across all packages                            |
| `pnpm typecheck`                   | `tsc` across all packages                             |
| `pnpm lint` / `pnpm format`        | ESLint / Prettier                                     |
| `pnpm build`                       | Production builds (web bundle, Worker dry-run)        |
| `pnpm db:generate`                 | Generate a migration from `apps/api/src/db/schema.ts` |
| `pnpm db:migrate`                  | Apply migrations to `DATABASE_URL`                    |

## Working spec-first

1. Change the spec first (and its Decision Log) when behaviour changes.
2. Reference IDs in code and tests (e.g. `// BR7`, `it('… (AC2.4)')`).
3. Shared rules (limits, validation, permissions) live only in `packages/shared`. Never copy them into the apps.
