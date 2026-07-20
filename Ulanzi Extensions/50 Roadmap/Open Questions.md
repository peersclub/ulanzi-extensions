---
tags: [roadmap, open-question]
---

# Open Questions

Unresolved items. Update as they're answered.

## 1. `hotkey` keylist format ⚠️ (blocking full control)

What exact string does `$UD.hotkey(keylist)` expect? Not in any shipped plugin.
Candidates: `escape` vs `esc`, `shift+tab`, `cmd+k`, `Meta+…`, case sensitivity.
- **Mitigation in place:** it's a per-key PI setting with defaults.
- **To resolve:** press a control key with the terminal focused, try variants,
  record the winner here, then update defaults in `plugins/claude-deck/src/app.js`.
- See [[Hotkeys & Control]].

## 2. Context % source

Claude Code's statusline payload doesn't reliably include context-window usage.
Options: parse the transcript JSONL for token totals; use a newer statusline field
if one exists; estimate. Until then the Context tile shows 0.
- See [[Adapter - Claude Code]].

## 3. Typing slash commands

A single `hotkey` is a combo, not text — can we type `/compact`? Likely need a
clipboard-paste fallback or a native UlanziDeck text action.

## 4. Plugin reload without Studio restart

Does Studio hot-reload a symlinked plugin, or is a restart/profile-toggle needed
after each rebuild? Confirm the smoothest [[Tooling|dev loop]] step.

## 5. Does Studio honor the dev symlink long-term?

Symlink created and resolves; confirm Studio loads a plugin through a symlink
across restarts (vs requiring a real folder / zip install).

## Answered

_(none yet — move items here with the answer + date)_
