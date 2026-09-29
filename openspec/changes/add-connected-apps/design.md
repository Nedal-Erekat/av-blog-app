# Design: Connected apps

## Context

See proposal.md for why. Today (from the remote MCP server work):

- `OAuthToken` rows hold hashed access (1 h) and refresh (30 d, rotated on use) tokens with
  `userId`, `clientId`, `scopes`, `expiresAt`, `revokedAt`.
- `OAuthGrant` rows record each consent; a successful exchange leaves the grant as `used`,
  with `userId` and `createdAt` (when the user approved it).
- `OAuthClient.metadata` holds what the app registered, including `client_name`.
- Every `/mcp` request re-verifies its Bearer token (`verifyAccessToken`), so revoking tokens
  is enough to cut an app off on its next request.
- The website talks to the API with the session cookie; `requireAuth` sets `req.userId`.

## Goals / Non-Goals

**Goals:**
- Server-enforced ownership: every query is filtered by the signed-in user's id.
- Revocation is immediate for both token kinds.
- No schema change or migration.

**Non-Goals:**
- Tracking last use, per-token views, or closing in-memory MCP sessions eagerly (they die on
  their next request because the token check fails).

## Decisions

### What counts as a connection
A connection is a `(userId, clientId)` pair with at least one token where `revokedAt IS NULL`
and `expiresAt > now()`. One entry per app, even though an app has several token rows (access
+ refresh, rotated over time).

- **Permissions shown**: the union of `scopes` across the active tokens.
- **"Approved on"**: `createdAt` of the most recent `used` grant for that user and app. Token
  `createdAt` is wrong here: refresh rotation creates new rows every hour, so it would show
  "approved an hour ago" for an app approved last month.
- *Alternative considered:* a new `OAuthConnection` table. Rejected: it duplicates what tokens
  and grants already say, needs a migration, and can drift out of sync.

### Revoking
One `updateMany` sets `revokedAt = now()` on all of the user's active tokens for that client
(`userId`, `clientId`, `revokedAt IS NULL`, `expiresAt > now()`). If it updated 0 rows, the
response is 404. That single rule covers "unknown app", "another user's app" and "already
disconnected" the same way, so the endpoint reveals nothing about other users.

### API (cookie-authenticated, website only)
- `GET /api/oauth/connections` → `200 { connections: ConnectedApp[] }`, newest approval first.
- `DELETE /api/oauth/connections/:clientId` → `204`, or `404` as above; `401` when signed out.
- Added to the existing website-facing OAuth router, next to the consent endpoints.

### Layering
New data access goes into a repository, following the project rule
(routes → services → repositories). The existing `apps/api/src/mcp/*` services call Prisma
directly; that's pre-existing debt, not changed here.

### Web
- `/dashboard/connected-apps`: a server component that loads the list through `lib/dal.ts`
  (which also sends signed-out visitors to sign in and back), linked from the dashboard.
- A client component renders the list. Disconnect uses a two-step inline confirmation
  ("Disconnect" → "Disconnect <app>? Yes / Cancel") rather than `window.confirm`: it's
  accessible, styleable and testable. On success the entry is removed and the page refreshed.
- The plain-language permission texts move from the consent form into `packages/shared`, so
  the consent page and this page always describe scopes the same way.

## Security and privacy

- **Ownership** is enforced in the SQL filters (`userId = req.userId`), never by the client.
- **No secrets leave the server**: responses contain only `clientId`, `clientName`, `scopes` and
  `approvedAt`, never token hashes or client secrets.
- **App names are untrusted** (any app can register any name, e.g. "Claude"). They're rendered
  as text (React escapes them), and the list shows the permissions, so a look-alike is at least
  visible. Verifying app identity is out of scope.
- **Enumeration**: 404 for everything that isn't the user's active connection (see Revoking).
- **CSRF**: the DELETE uses the existing cookie session with `SameSite=Lax` and a non-simple
  method from the website origin only (CORS), the same protection as other website mutations.

## Risks / Trade-offs

- [An MCP request already in progress when the user disconnects can still finish] → Acceptable:
  the next request fails. Closing sessions eagerly would need a cross-module hook for little gain.
- [Showing the union of scopes can overstate access if an app holds tokens from two approvals
  with different scopes] → Correct in the safe direction; disconnecting revokes all of them.
- [A user with many apps] → No pagination; an account realistically has a handful. Revisit if not.

## Migration Plan

None: no schema change. Deploy API and web together (the web page 404s against an older API).
Rollback = revert; revoked tokens stay revoked, which is the safe state.
