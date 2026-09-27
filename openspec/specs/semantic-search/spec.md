# semantic-search Specification

## Purpose
Find posts by meaning, not only by exact words, using embeddings stored in Postgres (pgvector),
with a keyword fallback so search always works.

## Requirements

### Requirement: Search by meaning
The system SHALL rank posts by the cosine similarity of their best-matching chunk to the query,
dropping matches below the similarity threshold, and SHALL show the match percentage.

#### Scenario: Semantic results
- **WHEN** anyone searches `GET /api/posts/search?q=…` (2-200 characters) and AI is available
- **THEN** the API responds with `mode: "semantic"` and posts ordered by similarity

#### Scenario: Query too short
- **WHEN** the query has fewer than 2 characters
- **THEN** the API responds 400

### Requirement: Keyword fallback
The system MUST fall back to case-insensitive keyword matching on title and content when AI is
not configured, fails, or the global semantic search cap (60/min) is reached.

#### Scenario: Degraded search
- **WHEN** the model is unavailable
- **THEN** the API responds with `mode: "keyword"` results instead of an error, and the page says AI search is unavailable

### Requirement: Search index freshness
The system SHALL chunk and embed a post in the background after it is created or its title or
content changes; indexing failures MUST NOT fail the save.

#### Scenario: Post saved while the model is down
- **WHEN** a post is saved and embedding fails
- **THEN** the post is saved normally and the failure is logged; `npm run ai:reindex` rebuilds the index
