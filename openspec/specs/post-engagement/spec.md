# post-engagement Specification

## Purpose
Readers engage with posts by commenting and liking. Reading comments is public; writing
comments and liking require an account.

## Requirements

### Requirement: Comments
The system SHALL list a post's comments publicly and let signed-in users add comments of
1-1000 characters; only a comment's author MAY delete it.

#### Scenario: Add a comment
- **WHEN** a signed-in user comments on an existing post
- **THEN** the API responds 201 with the comment and its author

#### Scenario: Post not found
- **WHEN** someone lists or adds comments for a post that does not exist
- **THEN** the API responds 404

#### Scenario: Delete someone else's comment
- **WHEN** a user tries to delete a comment they did not write
- **THEN** the API responds 403 and the comment stays

### Requirement: Likes
The system SHALL let a signed-in user like or unlike a post with a single toggle, at most one
like per user per post, and report the new state and count.

#### Scenario: Toggle
- **WHEN** a signed-in user toggles the like on a post
- **THEN** the API responds with `{ liked, likeCount }` reflecting the new state

#### Scenario: Like status
- **WHEN** a signed-in user asks whether they liked a post
- **THEN** the API responds with `{ liked }`
