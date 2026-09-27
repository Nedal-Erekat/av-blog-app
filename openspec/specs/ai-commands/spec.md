# ai-commands Specification

## Purpose
Drive the blog with plain words: an in-app command bar (our AI picks an action) and WebMCP tools
(a browser's built-in AI calls the same actions), both through one shared set of blog actions.

## Requirements

### Requirement: Shared blog actions
The system SHALL offer the actions find_posts, open_post, draft_post_with_ai, prepare_post and
publish_post through one browser-side runner that validates arguments and requires sign-in for
the write actions.

#### Scenario: Invalid arguments
- **WHEN** an AI calls an action with invalid arguments or an unknown name
- **THEN** nothing happens and the result explains what was invalid

#### Scenario: Signed out
- **WHEN** a signed-out visitor's AI calls prepare_post, publish_post or draft_post_with_ai
- **THEN** the result asks them to sign in first

### Requirement: Publishing needs confirmation
The system MUST show the post in a confirmation dialog (Publish / Edit first / Cancel) before
any AI-requested publish, and MUST NOT publish without the Publish click.

#### Scenario: User cancels
- **WHEN** the user clicks Cancel or presses Escape
- **THEN** nothing is published and the AI is told the user cancelled

#### Scenario: Edit first
- **WHEN** the user clicks Edit first
- **THEN** the New Post editor opens pre-filled and nothing is published

### Requirement: Command bar
The system SHALL let signed-in users open a command bar (button or Ctrl/Cmd+K), turn their text
into one validated action on the server (which never executes it), and run it in the browser.

#### Scenario: Write a post about a topic
- **WHEN** the user types "I want to create a blog about design tokens"
- **THEN** the writing assistant drafts it and the New Post editor opens pre-filled

#### Scenario: Find posts
- **WHEN** the user types "show me posts about remote work"
- **THEN** the search results page for that topic opens

### Requirement: WebMCP tools
The system SHALL register the blog actions with `document.modelContext` (or the deprecated
`navigator.modelContext`) when the browser supports WebMCP, with read-only and untrusted-content
hints, and SHALL unregister them when the page unmounts.

#### Scenario: Unsupported browser
- **WHEN** the browser has no `modelContext`
- **THEN** nothing is registered and the site works normally
