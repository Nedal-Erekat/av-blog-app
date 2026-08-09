# Avertra Blog Platform

[![CI](https://github.com/Nedal-Erekat/av-blog-app/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Nedal-Erekat/av-blog-app/actions/workflows/ci.yml)

Full-stack blogging platform monorepo built for the Avertra Senior JavaScript Engineer assessment.

- Frontend: Next.js 16 (App Router) + React 19 + Tailwind, Context API for auth state
- Backend: Express + Prisma REST API, PostgreSQL (Supabase)
- Auth: JWT in an httpOnly cookie
- Design pattern: Repository (data access) + Singleton (Prisma client) — see [`docs/design-pattern.md`](docs/design-pattern.md)
- Architecture: see [`docs/system-design.md`](docs/system-design.md)

## Live Demo

- Web: https://av-blog-app-web-nine.vercel.app/
- API: https://av-blog-app.onrender.com/api/health

Both are on free tiers. The API (Render) spins down after 15 minutes of inactivity — the first request after idle takes ~30-50s to wake it back up before responding.

## Structure

```
apps/
  web/      Next.js (App Router) frontend
  api/      Express + Prisma REST API
packages/
  shared/   zod schemas + TS types shared by both apps
docs/       system design and design pattern write-ups
```

## Prerequisites

- Node.js 20+
- A PostgreSQL database (a free [Supabase](https://supabase.com) project works well — it gives you both a pooled and a direct connection string, which Prisma needs, see below) — or use the Docker Compose setup below, which provisions Postgres for you

## Setup (local, without Docker)

1. Install dependencies:
   ```bash
   npm install
   ```
   This also builds `packages/shared` automatically (via a root `postinstall` script) and generates the Prisma client.

2. Configure environment variables:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
   Edit `apps/api/.env`:
   - `DATABASE_URL` — your app's runtime connection string, through Supabase's **pooled** (PgBouncer, transaction-mode) endpoint, port `6543`, with `?pgbouncer=true`:
     ```
     postgresql://postgres.<project-ref>:<password>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - `DIRECT_URL` — a **direct** (non-pooled) connection, port `5432`, used only for running migrations (PgBouncer's transaction mode can't run the DDL Prisma migrations need):
     ```
     postgresql://postgres.<project-ref>:<password>@<region>.pooler.supabase.com:5432/postgres
     ```
     Both strings are on your Supabase project's Database settings page. `schema.prisma`'s `datasource` block already wires `url` to `DATABASE_URL` and `directUrl` to `DIRECT_URL` — Prisma picks the right one automatically depending on whether it's running a query or a migration.
   - `JWT_SECRET` — any long random string (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `PORT`, `FRONTEND_URL` — defaults work for local dev

3. Apply database migrations:
   ```bash
   npm run prisma:migrate -w apps/api
   ```
   This applies every migration in `apps/api/prisma/migrations/` to your database (via `DIRECT_URL`). In production, use `npx prisma migrate deploy` (no schema drift prompts) instead of `migrate dev`.

4. Start both apps:
   ```bash
   npm run dev
   ```
   - Web: http://localhost:3000
   - API: http://localhost:4000/api/health

## Setup (Docker Compose)

```bash
docker-compose up --build
```

That's the whole setup — no `.env` copying needed. `apps/api/.env.docker` and `apps/web/.env.docker`
are committed to the repo (unlike `apps/*/.env`, which are gitignored) because they hold only
throwaway values scoped to the local Compose network, no real credentials. It runs `web`, `api`,
and a `postgres` container together, applying migrations **and seed data** automatically on API
startup — no manual seed step needed, you get a populated demo instantly.
Web at http://localhost:3000, API at http://localhost:4000.

The seed (`apps/api/prisma/seed.ts`) upserts rather than inserts, so it's safe to run on every
startup/restart, not just the first one — no duplicate-row risk. To re-seed manually at any other
time (e.g. after wiping data): `docker-compose exec api npx prisma db seed`.

<details>
<summary>What's in those files, and why the values differ from local dev</summary>

Compose needs container-network values (`postgres:5432`, `api:4000`) rather than `localhost`,
since inside a container `localhost` is that container itself.

`apps/api/.env.docker`:

```
PORT=4000
NODE_ENV=production
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/av_blog?schema=public
DIRECT_URL=postgresql://postgres:postgres@postgres:5432/av_blog?schema=public
JWT_SECRET=docker-compose-dev-secret-change-me
FRONTEND_URL=http://localhost:3000
```

The Compose Postgres container has no pooler, so `DATABASE_URL` and `DIRECT_URL` are the same value
here — the pooled/direct split only matters against Supabase.

`apps/web/.env.docker`:

```
NEXT_PUBLIC_API_URL=http://api:4000
```

`api:4000` (the Compose service name), not `localhost:4000` — the value is used by the Next
*server* to reach the API container, and inside the web container `localhost` is the web container
itself. The browser never uses it: it calls the web app's own origin, which proxies to the API via
the `rewrites()` in `next.config.js`. Because Next inlines `NEXT_PUBLIC_*` and bakes rewrites into
the routes manifest at build time, the same value is also passed as a Docker build arg in
`docker-compose.yml`.

Both files are loaded by `docker-compose.yml` via `env_file`.

</details>

To point the Compose stack at a hosted database (Supabase, Neon, …) instead of the bundled
`postgres` container, replace `DATABASE_URL`/`DIRECT_URL` in `apps/api/.env.docker` with that
provider's connection strings — nothing else changes.

## Testing

```bash
npm test              # run both workspaces' test suites
npm run test:coverage # same, with coverage reports
```

Backend tests (`apps/api/tests/`) include Supertest integration tests against a real Postgres database, plus service-layer unit tests (`tests/unit/`) with mocked repositories — no DB required for those. Frontend tests (`apps/web/src/**/*.test.tsx`) use Jest + React Testing Library.

## Linting & type checking

```bash
npm run lint
npm run typecheck
```

## CI/CD

The pipeline covers linting, testing, and deployment. The first two run in GitHub Actions; the third
is delegated to the hosting platforms on purpose. Both halves fire on every push to `main` — the
badge at the top of this README reflects the latest run.

### Lint + test (GitHub Actions)

`.github/workflows/ci.yml` runs on every push/PR to `main`, split into separate per-app jobs so
backend and frontend run on their own runners:

| Job | Does |
|---|---|
| `lint-api` / `lint-web` | `eslint` + `tsc --noEmit` |
| `test-api` | Jest against a real Postgres service container, with coverage |
| `test-web` | Jest + React Testing Library, with coverage |
| `build-api` / `build-web` | production build, each gated on its own app's lint + test jobs |

Splitting per app means a frontend failure doesn't mask a backend one, and both halves run in
parallel rather than one long serial job.

### Deploy (Vercel + Render native GitHub integrations)

**This is a deliberate choice, not a missing workflow step.** Vercel and Render each watch `main`
through their own first-party GitHub App and deploy on push — `apps/web` to Vercel, `apps/api` to
Render, with `prisma migrate deploy` on release.

Reimplementing that in Actions would mean minting deploy tokens (`VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`, `RENDER_DEPLOY_HOOK_URL`), storing four long-lived secrets in the repo, and
then disabling the platforms' auto-deploy to stop every push building twice — all to reproduce
behavior that already works with zero credentials in the repo. The trade-off accepted in exchange:
deployment isn't gated on CI going green, so a red build can still reach production. On a team
where that mattered, the fix is Actions-driven deploys with `needs: [build-api, build-web]`, or
protected-branch rules requiring CI to pass before anything merges to `main` — the latter gets the
gate without the token sprawl, and is what I'd reach for first.

### Platform configuration

On Render, set the service's build/start commands to `npm ci && npm run build -w apps/api` / `npm start -w apps/api` (leave **Root Directory** unset so the npm workspace `-w` commands run from the repo root — `npm ci` triggers the root `postinstall`, which builds `packages/shared` automatically), and set the environment variables to match `apps/api/.env` (`DATABASE_URL` + `DIRECT_URL` pointing at your production Postgres, and `FRONTEND_URL` pointing at your deployed Vercel URL).

On Vercel, set **Root Directory** to `apps/web` and leave Install/Build Command on their auto-detected defaults — Vercel's own npm-workspaces monorepo detection handles building `packages/shared` first. Overriding those commands manually (e.g. `cd ../.. && npm ci`) can fight that detection and produce a "No Next.js version detected" build failure even though `next` is correctly listed in `apps/web/package.json`.

Live URLs: see [Live Demo](#live-demo) above.

## Seeding

```bash
npm run seed -w apps/api                        # local (without Docker) — manual, run once
docker-compose exec api npx prisma db seed      # against the Compose stack — only needed to re-seed; it already runs automatically on `docker-compose up`
```

Creates four categories, a demo author (`demo@avertra.com` / `Demo1234!`), and eight posts spread
across those categories, so the post list and the category filter have something to show on a fresh
database. Every write is an upsert keyed on a unique field, so re-running it is safe.

Seeding is optional — you can register your own user at `/register` and create posts through the UI
instead. Categories don't have a create endpoint, but they aren't seed-only either: typing a new
category name on the post form creates it on the fly (`resolveCategoryId` in
`apps/api/src/services/post.service.ts`).
