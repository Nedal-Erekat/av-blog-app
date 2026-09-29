## ADDED Requirements

### Requirement: Connected apps
The system SHALL let a signed-in user see the AI apps that currently have access to their
account and disconnect any of them. An app counts as connected when the user has at least one
access or refresh token for it that is neither revoked nor expired. Users MUST only be able to
see and disconnect their own connections.

#### Scenario: List connected apps
- **WHEN** a signed-in user opens the Connected apps page
- **THEN** they see one entry per connected app, with the app's name, its permissions in plain words ("Search and read posts", "Write drafts and publish posts as you") and the date access was approved, most recent first

#### Scenario: No connected apps
- **WHEN** a signed-in user with no connected apps opens the page
- **THEN** they see a short explanation that no apps are connected and how apps get connected

#### Scenario: Apps that no longer have access are not listed
- **WHEN** all of an app's tokens for the user are revoked or expired
- **THEN** that app is not listed

#### Scenario: Disconnect an app
- **WHEN** the user clicks Disconnect for an app and confirms
- **THEN** all of that app's access and refresh tokens for this user are revoked, the app disappears from the list, and the app's next MCP request with its old access token is rejected with 401

#### Scenario: Disconnect needs confirmation
- **WHEN** the user clicks Disconnect and then cancels the confirmation
- **THEN** nothing is revoked

#### Scenario: Reconnecting after a disconnect
- **WHEN** a disconnected app starts the OAuth flow again
- **THEN** the user must approve it again on the consent page

#### Scenario: Other users are unaffected
- **WHEN** a user disconnects an app that other users have also connected
- **THEN** only this user's tokens are revoked; the other users' access keeps working

#### Scenario: Not signed in
- **WHEN** a signed-out visitor requests the list or a disconnect through the API
- **THEN** the API responds 401; opening the page sends them to sign in and back to the page

#### Scenario: Not connected or someone else's connection
- **WHEN** a user tries to disconnect an app that has no active tokens for their account (including an app only another user connected, or an unknown app id)
- **THEN** the API responds 404, the same for all three cases, and nothing is revoked
