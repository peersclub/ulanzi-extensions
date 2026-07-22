---
tags: [adapter, feature]
---

# Multi-Session & Naming

Supports running **many Claude Code terminals at once**, each building something
different. The deck follows the one you're interacting with and labels it.

## How it works

- Each session writes its own file: `~/.ulanzi-ai/sessions/claude-code__<session_id>.json`
  (keyed by Claude Code's `session_id`) — so concurrent terminals never clobber
  each other. See [[Broker Contract]] / [[Package - broker]].
- **Name** = `ULANZI_SESSION_NAME` env → else the project folder → else `folder:branch`.
- **"Current" session** = the one with the newest `activeTs`. `activeTs` advances
  **only on user-facing events** (`UserPromptSubmit` → thinking, `Notification` →
  awaiting_input), never on background tool ticks. So the terminal you *prompt*
  becomes current; a busy background agent can't steal the deck.

## The two subtle bugs (fixed, tested)

1. A never-interacted session must have `activeTs = 0`, not its first-write time —
   otherwise a fresh busy session outranks one you actually prompted.
2. Sort must be **two-level** (`activeTs` then `ts`), not `activeTs || ts` — the
   `||` let a 0 fall back to write-time and re-win. Regression-tested in
   `packages/broker/index.test.mjs`.

## On the deck

- **Session Name** tile → current session's name + live count.
- **Status** tile subtitle → the session name (so a green "done" is unambiguous).
- All info tiles (Model/Context/…) reflect the current session and switch together.

## Naming a terminal

Priority: **`/session` override → `ULANZI_SESSION_NAME` env → project folder.**

**`/session <name>`** (recommended, rename anytime) — a real Claude Code command
(`~/.claude/commands/session.md`) that expands to a sentinel; the
`UserPromptSubmit` hook (which alone has the `session_id`) catches it, persists
the name to `~/.ulanzi-ai/names/<id>`, switches the deck to that session, and
blocks the text so the model never sees it.

```
/session api          # relabels THIS terminal's key to "api", deck follows
```

**At launch** — `ULANZI_SESSION_NAME="backend" claude`.

Otherwise it's the project folder (e.g. `ulanzi-lab`, `my-api`).

> [!note] Why a hook, not the command's !bash
> There is no `CLAUDE_SESSION_ID` env var, so a slash command's `!bash` can't
> tell which session it's in (it would mislabel same-folder terminals). Only the
> hook receives `session_id`. The command is a thin trigger; the hook does the
> work. See [[Open Questions]] for the one link that needs a live smoke test.

Related: [[Claude Deck]] · [[Adapter - Claude Code]] · [[Open Questions]]
