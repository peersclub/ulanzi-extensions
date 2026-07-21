---
tags: [adapter]
---

# Adapter - Claude Code

Feeds live Claude Code state into the [[Broker Contract|broker]]
(`~/.ulanzi-ai/claude-code.json`). Source: `adapters/claude-code/`.

## Pieces

| Script | Wired as | Writes |
|---|---|---|
| `statusline.mjs` | Claude Code `statusLine` command | model, cwd, linesChanged, sessionSecs, costSession, contextPct |
| `hook.mjs <status>` | Claude Code hooks | status (+ lastTool on PreToolUse) |
| `lib/context.mjs` | used by statusline | computes `contextPct` from the transcript |
| `lib/broker-write.mjs` | shared | self-contained atomic merge writer |

**contextPct** is computed by `lib/context.mjs` from the transcript's token usage
(input + cache tokens ÷ context window). See the resolved note in [[Open Questions]].

## Status mapping

`SessionStart→idle` · `UserPromptSubmit→thinking` · `PreToolUse→tool` ·
`PostToolUse→thinking` · `Notification→awaiting_input` · `Stop→done`.

## Install

```bash
node adapters/claude-code/install.mjs           # dry run — prints the merge
node adapters/claude-code/install.mjs --apply    # backs up + writes ~/.claude/settings.json
```

- Only sets `statusLine` if you don't already have one (else prints what to append).
- Hook entries are **tagged** → re-running is idempotent, never duplicates.

## Why a self-contained writer

`broker-write.mjs` duplicates ~20 lines of [[Package - broker]] on purpose: these
scripts run from `~/.claude`, invoked globally by Claude Code, so they must not
depend on the repo's location or `node_modules`.

## Statusline payload notes

Fields used: `model.display_name`, `workspace.current_dir`, `cost.{total_cost_usd,
total_duration_ms, total_lines_added, total_lines_removed}`. Context % is not
reliably present — see [[Open Questions]].
