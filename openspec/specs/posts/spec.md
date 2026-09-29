# posts Specification

## Purpose
Publishing and reading blog posts, organized by optional categories. Anyone can read; only
signed-in users can write, and only authors can change or delete their own posts.

## Requirements

### Requirement: Reading posts
The system SHALL list posts publicly, newest first, each with its category and like/comment
counts, and SHALL show a single post by its slug.

#### Scenario: List and filter
- **WHEN** anyone requests `GET /api/posts`, optionally with `authorId` or `category` (slug)
- **THEN** the API responds 200 with the matching posts, newest first

#### Scenario: Unknown slug
- **WHEN** anyone requests a post slug that does not exist
- **THEN** the API responds 404

### Requirement: Creating posts
The system SHALL let signed-in users create a post with a title (1-200 characters), content,
an optional excerpt (up to 300) and an optional category name (up to 50).

#### Scenario: Created with derived fields
- **WHEN** a signed-in user creates a post without an excerpt
- **THEN** the API responds 201; the slug is derived from the title and the excerpt from the first 160 characters of the content

#### Scenario: Slug collision
- **WHEN** a post is created with a title whose slug is already taken
- **THEN** the new post gets a numbered suffix (e.g. `hello-world-2`)

#### Scenario: New category
- **WHEN** a post names a category that does not exist yet
- **THEN** the category is created and appears in `GET /api/categories`

#### Scenario: Not signed in or invalid
- **WHEN** a signed-out visitor creates a post, or the input is invalid
- **THEN** the API responds 401 or 400 respectively

### Requirement: Changing and deleting posts
The system MUST allow only a post's author to update or delete it.

#### Scenario: Author edits
- **WHEN** the author updates any of title, content, excerpt or category
- **THEN** the API responds 200 with the updated post

#### Scenario: Not the author
- **WHEN** another signed-in user tries to update or delete the post
- **THEN** the API responds 403 and nothing changes

#### Scenario: Delete
- **WHEN** the author deletes the post
- **THEN** the API responds 204 and the post's comments, likes and search index entries are removed with it
