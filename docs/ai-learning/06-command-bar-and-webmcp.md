# Step 6 — Command bar & WebMCP: one set of actions, many AIs

Two new ways to drive the blog with plain words:

- **Command bar** (Phase 1): click **✨ Ask AI** or press **Ctrl/Cmd+K**, then type
  *"show me posts about remote work"* or *"I want to create a blog about design tokens"*.
- **WebMCP** (Phase 2): an AI agent built into the browser can call the same actions directly
  in the page, using the user's session.

Either way, nothing is published until the user confirms it in a dialog.

## The architecture

```
 "write a blog about X"                             browser's own AI agent
         │                                                    │
         ▼                                                    │  WebMCP:
  Command bar ──► POST /api/ai/command                        │  document.modelContext
                  (our Gemini PICKS one action,               │  .registerTool(...)
                   validated, returned, never run)            │
         │                                                    │
         └────────────────►  Blog action runner  ◄────────────┘
                             (apps/web/src/lib/blog-actions.ts)
                             • validates arguments (zod)
                             • checks sign-in for write actions
                             • asks the user before publishing
                                        │
                                        ▼
                                 the existing API
```

**One list of actions** (`packages/shared/src/schemas/actions.ts`) and **one runner** serve
every entry point. A future remote MCP server (Phase 3) will plug into the same list. Add an
action once, and every AI entry point gets it, with the same rules.

## The actions

| Action | Does | Needs sign-in | Changes data |
|---|---|---|---|
| `find_posts(topic)` | Semantic search: shows the results page and returns the posts | no | no |
| `open_post(slug)` | Opens a post | no | no |
| `draft_post_with_ai(topic, mode)` | Runs the step 5 agent; `edit` opens the editor pre-filled, `publish` asks to publish | yes | only after confirmation |
| `prepare_post(title, content, …)` | Opens the editor pre-filled (for agents that write the text themselves) | yes | no |
| `publish_post(title, content, …)` | Shows the post and asks **Publish / Edit first / Cancel** | yes | only after confirmation |

## Key concepts

**Intent routing.** The command bar's model does one small job: map free text to one action
and its arguments, using tool calling (step 5) with the actions as tools. It doesn't *run* the
action; the API just returns it, validated. The browser runs it as the signed-in user. The
server-side AI never gets more power than a person clicking around.

**WebMCP.** A W3C community proposal: a page registers tools with
`document.modelContext.registerTool({ name, description, inputSchema, execute, annotations }, { signal })`.
A browser's AI agent can discover and call them. Key properties:

- The tool runs **in the page**, with the user's cookies: no API keys and no separate login.
- `annotations.readOnlyHint` tells agents which tools are safe to call freely.
- `annotations.untrustedContentHint` marks results containing user-written text (search
  results), so the agent shouldn't obey instructions inside them. That's prompt-injection
  thinking from steps 3–5, now as a standard hint.
- Aborting the `signal` unregisters the tools (our component does this on unmount).
- It's **experimental**: Chrome has it behind `chrome://flags/#enable-webmcp-testing` or an
  origin trial. `navigator.modelContext` was the older location and is now deprecated. The
  component supports both, and does nothing in browsers without it.

**Human in the loop, enforced in one place.** Whichever AI asks, `publish_post` waits for the
user's click in `ConfirmPublishDialog`. "Edit first" opens the editor instead; Esc cancels. The
AI gets the outcome back as a result (`"The user cancelled publishing."`) so it can respond.

**Validate at every boundary.** The model's choice is validated on the server
(`BlogActionCallSchema`), *and* again in the browser runner, because WebMCP arguments come
straight from a third-party agent. Drafts handed to the editor through `sessionStorage` are
validated when read, too.

**Handing data between pages.** A full post is too long for a URL, so drafts travel through
`sessionStorage` (this tab only, removed once read) plus an event for when the editor is
already open (`lib/pending-draft.ts`).

## Try it

**Command bar:** add `GEMINI_API_KEY`, sign in, press Ctrl+K:
- *"show me posts about remote work"* → the search results page
- *"I want to create a blog about design tokens"* → the editor pre-filled (takes a few seconds: the agent researches first)
- *"write and publish a post about our postmortems"* → the confirmation dialog

**WebMCP** (Chrome):
1. Open `chrome://flags/#enable-webmcp-testing`, enable it, and restart Chrome.
2. Open the blog and sign in. In the DevTools console, `document.modelContext` should now be
   defined; the blog registers its tools on page load.
3. Use a browser agent that supports WebMCP, or an inspector extension such as the ones in
   Google's `webmcp-tools` repo, to list and call the tools.

## Exercises

1. Add a `list_categories` action (read-only). Where do you add it, and do both the command bar
   and WebMCP pick it up automatically? (They should: that's the point of the shared list.)
2. Type something ambiguous, such as *"postgres"*. Which action does the router choose? How would
   you make it ask a clarifying question instead?
3. Make the command bar show *which* action it's about to run ("Searching for…", "Drafting…")
   before running it. Why is that good for trust?
4. A WebMCP agent calls `publish_post` 20 times in a row. What happens? What limit would you add,
   and where?
5. Phase 3 preview: sketch a remote MCP server (`/mcp`) exposing the same actions to Claude
   Desktop. Which actions can it support without a browser? How would "confirm before publishing"
   work there?
