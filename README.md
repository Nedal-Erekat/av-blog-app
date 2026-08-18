# Avertra Blog Platform

[![CI](https://github.com/Nedal-Erekat/av-blog-app/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Nedal-Erekat/av-blog-app/actions/workflows/ci.yml)

Full-stack blogging platform built for the Avertra Senior JavaScript Engineer assessment.

- **Frontend** — Next.js 16 (App Router), React 19, Tailwind, Context API for auth state
- **Backend** — Express + Prisma REST API, PostgreSQL
- **Auth** — JWT in an httpOnly cookie
- **Docs** — [design pattern](docs/design-pattern.md) · [system design](docs/system-design.md)

## Live demo

- Web: https://av-blog-app-web-nine.vercel.app/
- API: https://av-blog-app.onrender.com/api/health

Free tier: the API sleeps after 15 minutes idle, so the first request can take ~30-50s.

## Structure

```
apps/web/          Next.js frontend
apps/api/          Express + Prisma REST API
packages/shared/   zod schemas + types used by both
docs/              design write-ups
```

## Run with Docker

```bash
docker-compose up --build
```

Starts `web`, `api`, and `postgres`, then applies migrations and seeds demo data automatically.
Web on http://localhost:3000, API on http://localhost:4000.

`apps/api/.env.docker` and `apps/web/.env.docker` are committed — they hold only local Compose
values, no real credentials. To use a hosted database instead, swap `DATABASE_URL` / `DIRECT_URL`
in `apps/api/.env.docker`.

> Values use Compose service names (`postgres:5432`, `api:4000`), not `localhost` — inside a
> container `localhost` is that container. `NEXT_PUBLIC_API_URL` is also passed as a build arg,
> because Next bakes it into the bundle at build time.

## Run locally

Requires Node 20+, [pnpm](https://pnpm.io) 10+, and a PostgreSQL database.

```bash
pnpm install                             # also builds packages/shared + generates Prisma client
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter @av-blog/api prisma:migrate
pnpm dev                                 # web :3000, api :4000
```

No pnpm installed yet? `corepack enable` — Node ships pnpm's exact pinned version (see `packageManager` in `package.json`) via Corepack, no separate install needed.

Set in `apps/api/.env`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | pooled connection (PgBouncer, port `6543`, `?pgbouncer=true`) |
| `DIRECT_URL` | direct connection (port `5432`) — migrations only |
| `JWT_SECRET` | 16+ random chars |

Two URLs because Prisma runs queries through the pooler but needs a direct connection for
migrations — PgBouncer's transaction mode can't run migration DDL.

## Seeding

```bash
pnpm --filter @av-blog/api prisma:seed       # local
docker-compose exec api npx prisma db seed   # Compose (already runs on startup)
```

Creates 4 categories, 8 posts, and a demo author (`demo@avertra.com` / `Demo1234!`). All upserts,
so re-running is safe. Optional — you can register at `/register` instead.

## Commands

```bash
pnpm test               # both workspaces
pnpm test:coverage
pnpm lint
pnpm typecheck
```

Backend has Supertest integration tests against real Postgres plus unit tests with mocked
repositories. Frontend uses Jest + React Testing Library.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`, as parallel per-app jobs:

| Job | Runs |
|---|---|
| `lint-api` / `lint-web` | eslint + `tsc --noEmit` |
| `test-api` | Jest against a Postgres service container |
| `test-web` | Jest + React Testing Library |
| `build-api` / `build-web` | production build, gated on that app's lint + test |

**Deployment** is handled by Vercel's and Render's native GitHub integrations, which deploy on push
to `main`. Doing it in Actions instead would mean storing four deploy tokens to reproduce something
that already works without them. The trade-off: deploys aren't gated on CI passing — branch
protection requiring CI is the fix, and is what I'd add on a real team.

### Platform setup

**Render** — build `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @av-blog/api build`,
start `pnpm --filter @av-blog/api start`. Leave Root Directory unset so workspace commands run from
the repo root. Set the same env vars as `apps/api/.env`.

> ⚠️ Render's build/start commands are set in its dashboard, not in this repo — they won't update
> themselves. Whoever merges the pnpm migration needs to update them there by hand, or the next
> deploy will fail on a stale `npm ci`.

**Vercel** — set Root Directory to `apps/web`, leave install/build commands on their defaults.
Vercel auto-detects `pnpm-lock.yaml` and switches its install command to pnpm accordingly; its
monorepo detection still builds `packages/shared` first.
