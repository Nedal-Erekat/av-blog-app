# user-auth Specification

## Purpose
Let people create an account and sign in, so they can write posts, comment, like, and use the
AI features. The website session is a JWT kept in an httpOnly cookie.

## Requirements

### Requirement: Registration
The system SHALL create an account from an email, a password of at least 8 characters and a
name, store only a bcrypt hash of the password, and sign the new user in.

#### Scenario: Successful registration
- **WHEN** a visitor registers with a new email, a valid password and a name
- **THEN** the API responds 201 with the public user (id, email, name, createdAt) and never the password hash
- **AND** it sets an httpOnly `token` cookie valid for 7 days

#### Scenario: Email already registered
- **WHEN** a visitor registers with an email that already has an account
- **THEN** the API responds 409

#### Scenario: Invalid input
- **WHEN** the email is malformed, the password is shorter than 8 characters, or the name is empty
- **THEN** the API responds 400 with field-level details

### Requirement: Sign in and sign out
The system SHALL sign users in with email and password, and MUST NOT reveal whether the email
or the password was wrong.

#### Scenario: Correct credentials
- **WHEN** a user signs in with the right email and password
- **THEN** the API responds 200 with the public user and sets the session cookie

#### Scenario: Wrong credentials
- **WHEN** the email is unknown or the password is wrong
- **THEN** the API responds 401 with the same "Invalid email or password" message in both cases

#### Scenario: Sign out
- **WHEN** a user signs out
- **THEN** the session cookie is cleared and the API responds 204

### Requirement: Current user and protected pages
The system SHALL expose the signed-in user and SHALL send signed-out visitors of protected
pages to the login page, returning them to where they were headed afterwards.

#### Scenario: Current user
- **WHEN** a signed-in user requests `GET /api/auth/me`
- **THEN** the API responds 200 with their public user; without a valid cookie it responds 401

#### Scenario: Return after sign-in
- **WHEN** a signed-out visitor opens a protected page that passes a return path (e.g. the OAuth consent page)
- **THEN** they are sent to `/login?next=<path>` and, after signing in, back to that path

#### Scenario: Open redirect blocked
- **WHEN** the `next` parameter is not a same-site path (e.g. `https://evil.example` or `//evil.example`)
- **THEN** the user is sent to `/` instead
