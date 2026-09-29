# Tasks

## 1. Shared contract

- [ ] 1.1 Add the `ConnectedApp` type (`clientId`, `clientName`, `scopes`, `approvedAt`) and `SCOPE_DESCRIPTIONS` (plain-language text per scope) to `packages/shared`; rebuild shared and verify both apps still typecheck
- [ ] 1.2 Use `SCOPE_DESCRIPTIONS` in `apps/web/src/components/OAuthConsentForm.tsx` instead of its local map; verify with the existing `OAuthConsentForm` tests (unchanged texts still pass)

## 2. API: list and revoke

- [ ] 2.1 Add `apps/api/src/repositories/oauth-connection.repository.ts` with `findActiveByUser(userId)` (active tokens joined with client name and latest `used` grant date) and `revokeActive(userId, clientId)` (returns the number of tokens revoked); verify with an integration test against Postgres covering: active vs revoked vs expired tokens, rotated refresh tokens counted once, approval date taken from the grant
- [ ] 2.2 Add `apps/api/src/services/connections.service.ts` (factory with an injectable repository): `listConnections(userId)` groups by app, unions scopes and sorts by `approvedAt` desc; `disconnect(userId, clientId)` throws `NotFoundError` when nothing was revoked; verify with unit tests using a fake repository
- [ ] 2.3 Add `GET /api/oauth/connections` and `DELETE /api/oauth/connections/:clientId` (both `requireAuth`) to `apps/api/src/routes/oauth-consent.routes.ts`; verify with integration tests in `apps/api/tests/mcp.test.ts`: 401 signed out; list shows only the caller's apps with no secrets; disconnect → 204, the app's old access token gets 401 on `/mcp` and its refresh token gets `invalid_grant`; another user's connection of the same app keeps working; unknown app, other user's app and already-disconnected app all → 404
- [ ] 2.4 Prove the ownership filter matters: temporarily drop the `userId` condition from `revokeActive`, confirm the "other user's app → 404 / other users unaffected" tests fail, then restore it

## 3. Web: Connected apps page

- [ ] 3.1 Add `getConnectedApps()` to `apps/web/src/lib/dal.ts` (uses `verifySession('/dashboard/connected-apps')` so signed-out visitors return here after signing in); verify via the page test in 3.3
- [ ] 3.2 Add `apps/web/src/components/ConnectedAppsList.tsx`: one row per app with name, permission texts and approval date; empty state; two-step inline Disconnect confirmation (Cancel revokes nothing); on success remove the row; show API errors; verify with component tests for each of these behaviors
- [ ] 3.3 Add `apps/web/src/app/dashboard/connected-apps/page.tsx` and a "Connected apps" link on the dashboard; verify with `npm run build -w apps/web` (route listed) and a render check of the dashboard link

## 4. Specs, docs and verification

- [ ] 4.1 Update `docs/ai-learning/07-remote-mcp-server.md`: remove "No connected apps page yet" from the limitations and mention the page in "Connect an app"; verify by reading the section
- [ ] 4.2 End-to-end check with a real browser: approve an MCP client via the consent page, see it on Connected apps, disconnect it, confirm its token now gets 401 on `/mcp`
- [ ] 4.3 Run lint, typecheck and tests for both apps, `npm run spec:validate`, and `openspec validate add-connected-apps --strict`; all pass
