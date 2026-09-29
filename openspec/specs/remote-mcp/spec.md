# remote-mcp Specification

## Purpose
Expose the blog as a remote MCP server so AI apps outside the browser (Claude, ChatGPT, …) can
search, read, draft and publish on a user's behalf, only after the user approves them via OAuth.

## Requirements

### Requirement: OAuth 2.1 authorization
The system SHALL support dynamic client registration, the authorization-code flow with PKCE
(S256), refresh tokens and revocation, and MUST store authorization codes and tokens only as
SHA-256 hashes.

#### Scenario: Discovery
- **WHEN** an app calls `/mcp` without a token
- **THEN** the API responds 401 with a `WWW-Authenticate` header pointing to the protected-resource metadata

#### Scenario: Consent
- **WHEN** an app sends the user to `/authorize`
- **THEN** the user signs in if needed and sees the website consent page naming the app, its permissions and the return host, with Approve and Deny

#### Scenario: Denied
- **WHEN** the user clicks Deny
- **THEN** the app receives `error=access_denied` and no code

#### Scenario: Code misuse
- **WHEN** a code is exchanged with the wrong PKCE verifier, or a second time
- **THEN** the token endpoint answers `invalid_grant`

#### Scenario: Refresh rotation
- **WHEN** a refresh token is used
- **THEN** a new pair is issued and the old refresh token stops working

### Requirement: MCP tools scoped to the approved user
The system SHALL provide find_posts and get_post with `posts:read`, and prepare_post,
publish_post and draft_post_with_ai only with `posts:write`; each MCP session MUST be usable
only by the user who opened it.

#### Scenario: Read-only connection
- **WHEN** the user approved only `posts:read`
- **THEN** the write tools are not listed

#### Scenario: Someone else's session
- **WHEN** a valid token from another user is sent with an existing session id
- **THEN** the API responds 404

### Requirement: Human confirmation for publishing
The system MUST publish only after the user confirms through MCP elicitation; when the app
cannot ask, it SHALL save the draft and return a review link that only the owner can open.

#### Scenario: Confirmed
- **WHEN** the app shows the confirmation and the user ticks Publish
- **THEN** the post is published and its URL returned

#### Scenario: App cannot ask
- **WHEN** the app does not support elicitation
- **THEN** nothing is published and the result contains a `/posts/new?handoff=…` review link

#### Scenario: Review link opened by someone else
- **WHEN** a different user opens the review link
- **THEN** the draft is not shown
