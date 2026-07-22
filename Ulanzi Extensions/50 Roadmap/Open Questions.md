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

## 6. Does slash-command expansion reach the UserPromptSubmit hook? (smoke test)

`/session <name>` relies on Claude Code delivering the *expanded* command text
(the `[[ulanzi-session]]` sentinel) to the `UserPromptSubmit` hook so it can
intercept + block it. All isolation tests pass; the live invocation is unverified.
- **To confirm:** run `/session test` in a terminal → the key should relabel to
  "test" and the prompt should NOT appear in the conversation.
- If it doesn't fire, fall back to a `UserPromptExpansion` hook (matcher
  `session`) which carries `command_name` + `session_id` at expansion time.

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

- **Context % source** (2026-07-21) — resolved by computing it from the session
  **transcript JSONL**: the last assistant message's
  `input + cache_creation + cache_read` tokens ÷ context window (200k, auto-bumped
  to 1M when usage exceeds 200k or the model is a 1M variant). Implemented in
  `adapters/claude-code/lib/context.mjs`, verified against real transcripts. See
  [[Adapter - Claude Code]].
