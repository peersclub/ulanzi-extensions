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

```bash
ULANZI_SESSION_NAME="backend" claude    # or export it in that shell
```

Otherwise it's the project folder (e.g. `ulanzi-lab`, `clarity-ai`).

Related: [[Claude Deck]] · [[Adapter - Claude Code]] · [[Open Questions]]
