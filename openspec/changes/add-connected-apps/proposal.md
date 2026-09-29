# Proposal: Connected apps

## Why

Authors who connect an AI app (Claude, ChatGPT, …) to their blog through the remote MCP server
have no way to see which apps can act on their account, or to take that access back. An
approval currently lasts until the refresh token expires (30 days, renewed on every refresh),
so a forgotten or compromised app keeps access indefinitely. Being able to revoke what you've
approved is a basic expectation of any OAuth integration.

## What Changes

- A **Connected apps** page for signed-in users, reachable from the dashboard, listing each AI
  app that currently has access to their account: the app's name, what it's allowed to do
  (read, or read and write), and when access was approved.
- A **Disconnect** action per app, with a confirmation step, that immediately revokes all of
  that app's tokens for this user. The app's next MCP request is rejected, and it must go
  through the consent page again to regain access.
- Two cookie-authenticated API endpoints the page uses: list my connections, and revoke one.
- Users can only ever see and revoke **their own** connections.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `remote-mcp`: adds a requirement that users can list and revoke the AI apps connected to
  their account.

## Non-goals

- Showing *when* an app last used its access (not tracked today; would need a write on every
  MCP request).
- Changing an app's permissions in place (disconnect and reconnect with different scopes instead).
- Admin views of other users' connections, or deleting registered OAuth clients.
- Notifying the user when a new app connects.

## Impact

- **API** (`apps/api`): a connections service and two routes under `/api/oauth/connections`;
  reads and updates the existing `OAuthToken` table (no schema change, no migration).
- **Web** (`apps/web`): a new `/dashboard/connected-apps` page, a client component for the
  Disconnect action, and a link from the dashboard.
- **Shared** (`packages/shared`): the response type for a connection.
- **Security**: revocation must take effect immediately for both access and refresh tokens, and
  ownership must be enforced on the server.
