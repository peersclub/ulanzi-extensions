---
tags: [plugin, feature, fleet]
---

# Fleet Deck (Codex-Micro style)

Built 2026-07-23, inspired by OpenAI's **Codex Micro** ($230 button pad whose six
frosted keys each show a live Codex thread's status). The Ulanzi equivalent for
**Claude Code**, layered on [[Multi-Session & Naming]].

## The mapping

| Codex Micro | Fleet Deck |
|---|---|
| 6 frosted thread keys | **Session Slot** keys — place up to 6, PI picks slot # |
| 🔵 thinking | blue — `thinking`/`tool` |
| 🟠 needs approval | amber — `awaiting_input` / pending [[Claude Deck\|ask]] |
| 🟢 unread message | green — **unread**: `finishedTs > max(viewedTs, activeTs)` |
| 🔴 error | red — `error` |
| press a thread key | **pin** the whole deck to that session (press again = unpin) |
| dial | **Fleet Dial** — rotate previews sessions, press pins |
| joystick workflows | **Macro** key — clipboard-injected command (`pbcopy` → `⌘V` → `enter`) |

## How pinning works

- `pins.json` in the broker dir; `currentSession()` returns the pinned session
  while it's live, else falls back to follow-the-interaction ([[Multi-Session & Naming]]).
- Slot press also writes `viewedTs` (clears green unread) — and that write wakes
  every watcher, so all tiles redraw at once.
- [[Claude Deck]]'s Name tile shows **📌** while pinned.

## Slot ordering

`startedTs` — stamped on a session's first write, never moves → slots are stable
(new sessions append; a busy session can't reshuffle the keys).

## Calibration notes

- Macro key's `⌘V` uses the documented Mac modifier format; `enter` is unproven
  on-device — both editable in the key's Property Inspector ([[Hotkeys & Control]]).
- Verified in sim: slot order, all four colors, pin override vs live real
  sessions, unread clearing, unpin restore.

Related: [[Claude Deck]] · [[Dynamic & Engaging Deck]] · [[Open Questions]]
