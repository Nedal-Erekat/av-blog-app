# Avertra Blog Platform

Full-stack blogging platform monorepo built for the Avertra Senior JavaScript Engineer assessment.

- Frontend: Next.js 14 (App Router) + Tailwind, Context API for auth state
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

1. Create the Docker env files (separate from `apps/*/.env`, since Compose needs container-network values like `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/...`, not `localhost`):
   ```bash
   apps/api/.env.docker
   apps/web/.env.docker
   ```
   `apps/api/.env.docker`:
   ```
   PORT=4000
   NODE_ENV=production
   DATABASE_URL=postgresql://postgres:postgres@postgres:5432/av_blog?schema=public
   DIRECT_URL=postgresql://postgres:postgres@postgres:5432/av_blog?schema=public
   JWT_SECRET=docker-compose-dev-secret-change-me
   FRONTEND_URL=http://localhost:3000
   ```
   The Compose Postgres container has no pooler, so `DATABASE_URL` and `DIRECT_URL` are the same value here — the pooled/direct split only matters against Supabase.
   `apps/web/.env.docker`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```
   Both are gitignored — `docker-compose.yml` loads them via `env_file`.

2. Build and run:
   ```bash
   docker-compose up --build
   ```

This runs `web`, `api`, and a local `postgres` container together, applying migrations automatically on API startup. Web at http://localhost:3000, API at http://localhost:4000.

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

- `.github/workflows/ci.yml` — runs on every push/PR to `main`, split into separate per-app jobs so backend and frontend run on their own runners: `lint-api`/`lint-web` (lint + typecheck), `test-api`/`test-web` (`test-api` runs against a Postgres service container), `build-api`/`build-web` (each gated on its own lint+test jobs passing). This is a quality gate, not a deploy trigger.
- **Deployment is handled by each platform's own native GitHub integration**, not by a custom Actions workflow: Vercel and Render both auto-deploy on push to `main` directly, using their first-party GitHub App credentials. There's no token/secrets wiring needed for this — it's on by default from when you connect the repo.

On Render, set the service's build/start commands to `npm ci && npm run build -w apps/api` / `npm start -w apps/api` (leave **Root Directory** unset so the npm workspace `-w` commands run from the repo root — `npm ci` triggers the root `postinstall`, which builds `packages/shared` automatically), and set the environment variables to match `apps/api/.env` (`DATABASE_URL` + `DIRECT_URL` pointing at your production Postgres, and `FRONTEND_URL` pointing at your deployed Vercel URL).

On Vercel, set **Root Directory** to `apps/web` and leave Install/Build Command on their auto-detected defaults — Vercel's own npm-workspaces monorepo detection handles building `packages/shared` first. Overriding those commands manually (e.g. `cd ../.. && npm ci`) can fight that detection and produce a "No Next.js version detected" build failure even though `next` is correctly listed in `apps/web/package.json`.

Live URLs: see [Live Demo](#live-demo) above.

## Seeding

There's no seed script — register a user through the UI (`/register`) and create posts from there.
