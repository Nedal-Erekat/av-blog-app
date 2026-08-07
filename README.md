# Avertra Blog Platform

Full-stack blogging platform monorepo built for the Avertra Senior JavaScript Engineer assessment.

## Structure

- `apps/web` — Next.js (App Router) frontend
- `apps/api` — Express + Prisma REST API
- `packages/shared` — shared zod schemas and TS types

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` in `apps/api` and `apps/web` and fill in values (see Phase 2 onward for required variables).

## Development

```bash
npm run dev
```

Runs both `apps/web` (http://localhost:3000) and `apps/api` (http://localhost:4000) concurrently.

## Testing

```bash
npm test
```

## Linting

```bash
npm run lint
```

Full setup/run instructions, system design doc, and design pattern write-up are completed in later phases (see `docs/` once added).
