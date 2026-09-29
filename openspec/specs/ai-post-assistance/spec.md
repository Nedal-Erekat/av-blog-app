# ai-post-assistance Specification

## Purpose
Help authors write posts with AI: suggest an excerpt and category for a draft, or have a
writing-assistant agent research existing posts and draft a new one for the author to review.

## Requirements

### Requirement: Suggested excerpt and category
The system SHALL suggest an excerpt (at most 300 characters) and a category for a draft title
and content (20-20,000 characters) and pre-fill the form; it MUST NOT save anything.

#### Scenario: Suggestion
- **WHEN** a signed-in author clicks "Suggest excerpt & category" on the post form
- **THEN** the excerpt and category fields are filled and remain editable

#### Scenario: Too little content
- **WHEN** the content is shorter than 20 characters
- **THEN** no AI call is made and the form shows why

### Requirement: Writing-assistant agent
The system SHALL let a signed-in author describe a post (10-1000 characters) and run an agent
that may only search posts, read posts, list categories and propose a draft; the draft MUST be
returned for review and never published by the agent.

#### Scenario: Draft proposed
- **WHEN** the author asks for a post about a topic
- **THEN** the response contains the draft and the list of steps the agent took, and the New Post form is pre-filled

#### Scenario: Agent limits
- **WHEN** the agent reaches 8 steps or 60,000 tokens without proposing a draft
- **THEN** it stops and returns a message with no draft

#### Scenario: Invalid or unknown tool call
- **WHEN** the model calls a tool with invalid arguments or a tool that does not exist
- **THEN** the error is returned to the model as a tool result and the run continues
