# Avertra Blog Platform

Full-stack blogging platform monorepo built for the Avertra Senior JavaScript Engineer assessment.

- Frontend: Next.js 14 (App Router) + Tailwind, Context API for auth state
- Backend: Express + Prisma REST API, PostgreSQL (Neon)
- Auth: JWT in an httpOnly cookie
- Design pattern: Repository (data access) + Singleton (Prisma client) — see [`docs/design-pattern.md`](docs/design-pattern.md)
- Architecture: see [`docs/system-design.md`](docs/system-design.md)

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
- A PostgreSQL database (a free [Neon](https://neon.tech) project works well) — or use the Docker Compose setup below, which provisions Postgres for you

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
   - `DATABASE_URL` — your Postgres connection string
   - `JWT_SECRET` — any long random string (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `PORT`, `FRONTEND_URL` — defaults work for local dev

3. Apply database migrations:
   ```bash
   npm run prisma:migrate -w apps/api
   ```

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
   JWT_SECRET=docker-compose-dev-secret-change-me
   FRONTEND_URL=http://localhost:3000
   ```
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

- `.github/workflows/ci.yml` — runs on every push/PR to `main`: lint, typecheck, backend tests against a Postgres service container, frontend tests, and a full build.
- `.github/workflows/deploy.yml` — runs after CI succeeds on `main`: deploys `apps/web` to Vercel and triggers a deploy hook for `apps/api` on Render.

To activate deploys, add these repo secrets under Settings → Secrets and variables → Actions:

| Secret | Where to get it |
|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel project → Settings → General |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General |
| `RENDER_DEPLOY_HOOK_URL` | Render service → Settings → Deploy Hook |

On Render, set the service's build/start commands to `npm ci && npm run build -w packages/shared && npm run build -w apps/api` / `npm start -w apps/api`, and set the same environment variables as `apps/api/.env` (with `DATABASE_URL` pointing at your production Postgres and `FRONTEND_URL` pointing at your deployed Vercel URL).

## Seeding

There's no seed script — register a user through the UI (`/register`) and create posts from there.
