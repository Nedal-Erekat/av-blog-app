# Avertra Blog — notes for AI coding agents

Full-stack blog (Next.js web + Express/Prisma API + shared zod package) with AI features
(Gemini behind `AiProvider`). Architecture, conventions and the non-negotiable AI rules are in
`openspec/config.yaml` (`context:`). Read it before planning a change.

## How we work: spec-driven development (OpenSpec)

Behavior is specified before it is built. The source of truth for what the system does today is
`openspec/specs/<capability>/spec.md`.

- **Any change to behavior** (feature, API, UI flow, data model, security rule) goes through a
  change proposal: `/opsx:propose` → the user reviews → `/opsx:apply` → `/opsx:archive`.
- **Don't implement during propose.** Planning and implementation are separate steps; wait for
  the user to approve the proposal.
- **Small fixes that don't change specified behavior** (typos, refactors, dependency bumps,
  test-only changes) don't need a proposal.
- If code and spec disagree, say so; don't silently pick one.
- Keep specs about observable behavior (status codes, what the user sees), not implementation.

`/opsx:explore` is for thinking through an idea before proposing it.

## Commands

```bash
npm install                     # also builds packages/shared
npm run dev                     # web :3000 + api :4000
npm run lint && npm run typecheck && npm test
npm run spec:validate           # OpenSpec specs + changes, strict
npm run build -w packages/shared   # after editing shared schemas
```

API tests need Postgres with pgvector (`DATABASE_URL` in `apps/api/.env`); run
`npx prisma migrate deploy` in `apps/api` first. AI features need `GEMINI_API_KEY`
(optional; without it AI endpoints answer 503 or degrade).

## Layout

- `apps/api/src`: `routes/` → `services/` → `repositories/`; `ai/` (provider, prompts safety,
  limits); `mcp/` (remote MCP server + OAuth); tests in `apps/api/tests`.
- `apps/web/src`: `app/` (routes), `components/`, `lib/dal.ts` (authorized reads),
  `lib/data.ts` (cached public reads), `lib/blog-actions.ts` (AI action runner).
- `packages/shared/src/schemas`: the API contract (zod).
- `docs/ai-learning/`: how each AI feature works, step by step.
