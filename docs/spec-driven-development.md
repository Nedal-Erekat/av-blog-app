# Spec-driven development with OpenSpec

We decide **what** a change does, in writing, before any code is written. The AI then builds
from a reviewed plan instead of a vague prompt, and the specs stay a true description of the app.

## The pieces

```
openspec/
├── config.yaml            # project context + rules: our "constitution" (shown to the AI every time)
├── specs/                 # how the app behaves TODAY, one folder per capability
│   ├── posts/spec.md
│   ├── remote-mcp/spec.md
│   └── …
└── changes/               # proposed changes, one folder each
    ├── <change-name>/
    │   ├── proposal.md    # why + what (+ non-goals)
    │   ├── specs/…        # DELTAS: requirements this change adds / modifies / removes
    │   ├── design.md      # how: files, data, security
    │   └── tasks.md       # checklist, each task with its test
    └── archive/           # finished changes (their deltas are merged into specs/)
```

A spec is a list of **requirements** ("The system SHALL …"), each with **scenarios**
(WHEN … THEN …). Scenarios read like acceptance tests, and usually become real tests.

## The loop (in Claude Code)

| Step | Command | Who | Result |
|---|---|---|---|
| 0. Think (optional) | `/opsx:explore` | you + AI | clarify the idea, no files |
| 1. Propose | `/opsx:propose <idea>` | AI writes, **you review** | `openspec/changes/<name>/` |
| 2. Apply | `/opsx:apply` | AI implements task by task | code + tests, tasks ticked |
| 3. Archive | `/opsx:archive` | AI | deltas merged into `openspec/specs/`, change archived |

The review in step 1 is the point of all this. Read the proposal and the spec deltas: is this
what you want, are the unhappy paths covered, is anything missing? Edit the files or ask for
changes, then apply.

**Needs a proposal:** new features, API or UI behavior changes, data model changes, security
rules. **Doesn't:** typos, refactors, dependency bumps, test-only changes.

## Commands

```bash
npm run spec:list        # changes in progress
npm run spec:validate    # validate all specs and changes (also runs in CI)
npx openspec show <name> # read a spec or change in the terminal
npx openspec view        # interactive dashboard
```

## Telemetry

OpenSpec sends anonymous usage stats (command names and version) unless you opt out. It's off in
CI automatically. On your machine, run once:

```bash
npx openspec config set telemetry.enabled false
```

(or set `OPENSPEC_TELEMETRY=0` / `DO_NOT_TRACK=1` in your shell).

## Upgrading OpenSpec

The version is pinned in `package.json` because the generated commands in `.claude/` match it.
To upgrade: bump the version, `npm install`, then `npx openspec update` to refresh `.claude/`.
