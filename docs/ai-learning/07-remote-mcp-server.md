# Step 7 — A remote MCP server with OAuth

The blog is now an **MCP server**. Any MCP-capable AI app (Claude Desktop, claude.ai,
Claude Code, ChatGPT, MCP Inspector, …) can connect to it, with the user's permission, and
search posts, read them, draft new ones with the writing assistant, and publish, always with
the user confirming.

Step 6 served AIs *inside* the browser (command bar, WebMCP). This step serves AIs *outside* it.
Both reuse the same argument schemas and services.

## The pieces

```
AI app ──1. POST /register ─────────────────────────► API   "I'm Claude" → client_id
       ──2. browser → GET /authorize (PKCE) ────────► API   saves a pending grant
                  └─► website /oauth/consent?grant=…         user signs in, clicks Approve
                  ◄── redirect back with ?code=…
       ──3. POST /token (code + PKCE verifier) ─────► API   → access token (1h) + refresh token (30d)
       ──4. POST /mcp  Authorization: Bearer … ─────► API   MCP tools, as that user
```

| File | Role |
|---|---|
| `apps/api/src/mcp/oauth-provider.ts` | OAuth storage and rules: grants, one-time codes, hashed tokens, refresh rotation. |
| `apps/api/src/mcp/consent.service.ts` + `routes/oauth-consent.routes.ts` | What the consent page shows; Approve / Deny. |
| `apps/api/src/mcp/blog-mcp-server.ts` | The MCP tools, bound to one user and their granted scopes. |
| `apps/api/src/mcp/mcp-router.ts` | Mounts the SDK's OAuth endpoints, Bearer auth, and per-user MCP sessions. |
| `apps/api/src/mcp/draft-handoff.service.ts` | Review links: a saved draft only its owner can open. |
| `apps/web/src/app/oauth/consent/page.tsx` | The consent page ("Claude wants to access your blog"). |

The official `@modelcontextprotocol/sdk` handles the protocol parts: the JSON-RPC messages, the
Streamable HTTP transport, the OAuth endpoints and metadata, and PKCE checks. We write the
parts that are about *our* app: storage, rules, tools and the consent UI.

## The tools

| Tool | Scope | What it does |
|---|---|---|
| `find_posts` | `posts:read` | Semantic search; returns titles, excerpts, links |
| `get_post` | `posts:read` | Full text of one post |
| `prepare_post` | `posts:write` | Saves a draft and returns a **review link**; nothing is published |
| `draft_post_with_ai` | `posts:write` | Runs the step 5 agent; returns a review link, or publishes after confirmation |
| `publish_post` | `posts:write` | Publishes **only after the user confirms** (see below) |

A connection approved with only `posts:read` doesn't even *see* the write tools.

## Key concepts

**OAuth 2.1 in one sentence:** the app never sees your password; you approve it on *your* site,
and it gets a token that's limited in scope and time, and revocable.

- **Dynamic client registration:** any app may register. That grants nothing on its own; access
  only comes from a user clicking Approve.
- **PKCE:** the app makes up a secret (`code_verifier`) and sends only its hash with `/authorize`.
  Someone who intercepts the code can't use it without the original secret.
- **One-time codes, short-lived grants:** a code works once, within 10 minutes. The "mark as
  used" update only succeeds if the code is still unused, so two parallel exchanges can't both win.
- **Refresh token rotation:** each refresh token works once and is replaced. A stolen old one
  is worthless.
- **Hash secrets at rest:** codes and tokens are stored as SHA-256 hashes, like passwords. A
  database leak doesn't hand out working tokens.
- **Discovery:** `/mcp` without a token answers 401 with a `WWW-Authenticate` header pointing to
  `/.well-known/oauth-protected-resource/mcp`, which points to the auth server's metadata. That's
  how an app finds out *how* to log in, with no configuration.

**Sessions belong to users.** MCP connections are sessions (`Mcp-Session-Id`). A session is tied
to the user who opened it: a *valid* token from another user with someone else's session id gets
404, exactly like a made-up id.

**Human in the loop, without a browser dialog.** The step 6 confirmation lived in the web page.
Here the MCP server uses **elicitation**: it asks the *app* to show the user a question ("Publish
this post under your name? ☐ Publish now") and waits for the answer. Apps that don't support
elicitation get a **review link** instead, and nothing is published. Either way, a person decides.
(Elicitation is why the server keeps sessions: the user's answer arrives on a separate HTTP
request, and has to find the tool call that's waiting for it.)

**Shared budgets.** The MCP tools use the same per-user rate limiters as the website
(`src/ai/limits.ts`), so switching to Claude Desktop doesn't double anyone's AI quota.

**CORS: different rules for different auth.** The website API allows only the website's origin,
because it uses cookies. `/mcp` allows any origin, because it uses Bearer tokens, which a browser
never attaches automatically. That's why the MCP routes are mounted *before* the website's CORS
middleware.

## Connect an app

In production, set `PUBLIC_API_URL` on the API to its public https URL (for example
`https://av-blog-app.onrender.com`), and run the migration. The MCP URL is then
`https://<api-host>/mcp`.

- **Claude Code:** `claude mcp add --transport http avertra-blog https://<api-host>/mcp`, then run
  `/mcp` in Claude Code to sign in.
- **claude.ai / Claude Desktop:** add a custom connector with the MCP URL (in Settings → Connectors;
  menu names can change). Your browser opens the consent page.
- **MCP Inspector** (for learning and debugging): `npx @modelcontextprotocol/inspector`, choose
  "Streamable HTTP", and enter the MCP URL.
- **Locally:** `http://localhost:4000/mcp`. The SDK allows plain http only for localhost.

Try: *"Find posts on the Avertra Blog about remote work"*, *"Draft a post about design tokens"*,
*"Publish a short post saying hello"*. Watch for the confirmation.

## Known limitations (good discussion material)

- **Sessions live in memory**, like the rate limiters: fine for one server. With several you'd
  need sticky routing or a shared store (such as Redis).
- **Confidential clients' secrets** (apps that register with `client_secret_post`) are stored as
  registered, because the SDK's client check compares them directly. Most MCP apps are *public*
  clients (PKCE, no secret), but a production system would hash these too with custom client auth.
- **No "connected apps" page yet** to see and revoke what you've approved (exercise 1).
- On Render's free tier the API sleeps, so the first connection can take ~30–50 s.

## Exercises

1. Build a **Connected apps** page in the dashboard: list the user's active tokens by app name,
   with a Revoke button. Which table and which fields do you need?
2. Connect MCP Inspector and look at the raw JSON-RPC: `initialize`, `tools/list`, `tools/call`.
   Find the `Mcp-Session-Id` header.
3. Approve an app with only `posts:read` (edit the `scope` in the authorize URL). Confirm the write
   tools are missing. Why is hiding them better than returning "forbidden"?
4. What happens if the same user connects from two apps at once? From two devices?
5. Add an `update_post` tool for the user's *own* posts. Where does the ownership check live, and
   how would you confirm edits with the user?
