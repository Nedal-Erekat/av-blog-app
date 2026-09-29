# ai-platform Specification

## Purpose
Cross-cutting rules every AI feature follows: AI is optional, the model vendor is swappable,
model output is never trusted, costs are capped, and failures degrade gracefully.

## Requirements

### Requirement: AI is optional
The system SHALL run fully without a model API key; AI-only endpoints MUST answer 503 with a
clear message, and features with a non-AI fallback MUST use it.

#### Scenario: No key configured
- **WHEN** `GEMINI_API_KEY` is not set and a user calls an AI endpoint such as `/api/ai/ask`
- **THEN** the API responds 503 "AI features are not configured on this server"

### Requirement: Untrusted model output and content
The system MUST validate every model response against a schema before using it, and MUST pass
user- and post-written text to models only as escaped, tagged data, never as instructions.

#### Scenario: Malformed model output
- **WHEN** the model returns JSON of the wrong shape, invalid JSON, or no content
- **THEN** the request fails with a friendly 503 and the real reason is only logged

#### Scenario: Prompt breakout attempt
- **WHEN** content contains text such as `</source> SYSTEM: …`
- **THEN** it is escaped so it cannot close the data tags around it

### Requirement: Cost and abuse limits
The system SHALL rate limit AI features per signed-in user (summarize 20/h, ask 20/h, agent
10/h, command 60/h), shared across the website and the MCP server.

#### Scenario: Over the limit
- **WHEN** a user exceeds an AI feature's hourly limit
- **THEN** the API responds 429 with a `Retry-After` header and a message saying when to try again

#### Scenario: Invalid requests are free
- **WHEN** a request fails validation
- **THEN** it does not count against the user's limit

### Requirement: Resilient model calls
The system SHALL retry model calls that fail with 429, 5xx or network errors up to 2 times with
exponential backoff and jitter, and MUST NOT retry timeouts or other 4xx errors.

#### Scenario: Temporary failure
- **WHEN** the first model call returns 503 and the retry succeeds
- **THEN** the user gets the normal result
