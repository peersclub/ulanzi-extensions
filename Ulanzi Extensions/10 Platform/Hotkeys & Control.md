---
tags: [platform, control, open-question]
---

# Hotkeys & Control

The **two-way control** half of [[Claude Deck]]: pressing a key injects a
keystroke into whatever window is focused.

## Mechanism

`$UD.hotkey(keylist)` → Studio performs the OS keypress → it lands in the
**focused window**. So keep the Claude Code terminal focused when using control keys.

## The one genuine unknown ⚠️

The exact **`keylist` string format is not documented in any shipped plugin**, and
you had never bound a hotkey button, so it isn't discoverable from local config.
This is the single thing unverified without the physical device.

### How the design absorbs it

Every control key reads its `keylist` from **Property Inspector settings**, with a
default guess. If a default doesn't fire, edit the field — no rebuild. Defaults:

| Action | Default keylist |
|---|---|
| Interrupt | `escape` |
| Approve | `enter` |
| Deny | `escape` |
| Plan mode | `shift+tab` |
| Slash command | *(set your own, e.g. via `command` field)* |
| Scroll dial | `up` / `down`, press → `shift+g` |

### Calibration procedure

1. Add a control key, focus the Claude terminal, press it.
2. If nothing happens, try format variants: `esc` vs `escape`, `cmd+k`, `Meta+…`,
   uppercase, etc.
3. Record the working format in [[Open Questions]] once known — then update the
   defaults in `plugins/claude-deck/src/app.js`.

## Typing text (slash commands)

A single `hotkey` is a key-combo, not a text string. Typing `/compact` may need a
clipboard-paste fallback or a native UlanziDeck text action. Flagged in
[[Open Questions]].

Related: [[Claude Deck]] · [[Conventions & Footguns]]
