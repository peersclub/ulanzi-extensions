# claude-code adapter

Feeds live Claude Code session state into the broker (`~/.ulanzi-ai/claude-code.json`),
which the **Claude Deck** plugin reads to render its info tiles.

It does **not** cover usage limits or cost — those are owned by the
`com.narlei.claudeusage` and `com.narlei.aicost` plugins on adjacent keys.

## What each piece provides

| Script | Wired as | Broker fields it writes |
|---|---|---|
| `statusline.mjs` | Claude Code `statusLine` command | `model`, `cwd`, `linesChanged`, `sessionSecs`, `costSession`, `contextPct`* |
| `hook.mjs <status>` | Claude Code hooks | `status`, `lastTool` |

\* `contextPct` is written only when the statusline payload exposes it; otherwise
the Context tile shows 0. See the defensive field probing in `statusline.mjs`.

### Status mapping (hooks)

| Event | status |
|---|---|
| `SessionStart` | `idle` |
| `UserPromptSubmit` | `thinking` |
| `PreToolUse` | `tool` (+ `lastTool`) |
| `PostToolUse` | `thinking` |
| `Notification` | `awaiting_input` |
| `Stop` | `done` |

## Install

```bash
# preview the exact settings.json merge (no writes)
node adapters/claude-code/install.mjs

# apply it (backs up ~/.claude/settings.json first; idempotent)
node adapters/claude-code/install.mjs --apply
```

The installer only sets `statusLine` if you don't already have one, and tags its
hook entries so re-running never duplicates them.

## ⚠ Restart existing sessions after installing

Claude Code reads `statusLine` and hooks at **launch**, so sessions that were
already running when you installed the adapter **won't report** to the deck —
they're invisible on the fleet/dashboard and to focus-follow. Fix: exit and
relaunch `claude` (or `claude --continue`) in those terminals. New sessions
appear instantly.

## Session visibility

The deck only knows a session while it's writing. An **idle, unfocused** session
eventually goes quiet and drops off (no "still open" heartbeat exists in Claude
Code) — re-touching or focusing it brings it back. The dashboard uses a 2h
window to keep recently-idle sessions visible with their last-write age.
