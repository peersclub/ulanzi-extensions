---
tags: [foundation, performance]
---

# Performance & Feedback

Closing the "feel" gap to first-party hardware (OpenAI's Codex Micro). The
inherent ceiling — no push API from Claude Code, no firmware LEDs — can't be
crossed by third-party code, but everything below it was:

## Measured latency (event → glass)

| Stage | Before | After |
|---|---|---|
| Claude hook event → broker write | ~56ms (node spawn per event) | **7ms** (unix-socket daemon) |
| Broker → tile wake (watch debounce) | ~55ms | **~30ms** (25ms debounce) |
| **Total event → glass** | ~200–300ms | **~40–80ms** |

## Hook fast path

The plugin hosts `~/.ulanzi-ai/hook.sock`; hook commands pipe events via
`nc -U` with automatic fallback to `node hook.mjs` when the deck is off. Both
paths run the SAME logic — extracted to `adapters/claude-code/lib/hook-core.mjs`
so they can never drift. **Exception:** `UserPromptSubmit` stays on the node
path — it must exit(2) to block the [[Multi-Session & Naming|/session]] sentinel,
and a socket can't return an exit code. Hook commands are snapshotted at session
launch → old sessions keep the slow path until restarted.

## Instant press echo

Every key repaints bright the moment it's pressed (one WS frame), *before* its
action runs — firmware-style acknowledgment. Restores the prior face ~140ms
later unless the action redrew (guarded by an icon sequence counter in the
runtime's `Button`). This is the single biggest perceived-responsiveness win.

## Motion

- Status spinner: 10fps / 30° steps (was ~6fps/45°), still text-capable SVG.
- [[Fleet Deck|Beacon]]: native GIF animation (zero ongoing traffic).
- Slot pulse: 2fps bg alternation (keeps the session name visible — GIFs can't
  carry dynamic text).

## On-device-only bugs this work surfaced (the full list)

1. QSvg rejects 8-digit hex colors → blank keys ([[Conventions & Footguns]])
2. Unhandled `error` EventEmitter → plugin crash on early spawn
3. One physical press fires `run` + `keydown` → double execution (pin toggles!)
4. Dials report `rotateEvent: "left"/"right"`, not `ticks` → direction lost
5. Claude renames tab titles → title-based focus matching fails ([[Focus Follow]])

None were catchable off-device. Hardware is the only honest test environment.

Related: [[Package - runtime]] · [[Adapter - Claude Code]] · [[Dynamic & Engaging Deck]]
