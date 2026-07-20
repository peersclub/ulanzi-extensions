---
tags: [plugin, flagship]
---

# Claude Deck

The flagship plugin. UUID `com.ulanzi.ulanzideck.claudedeck`. Source in
`plugins/claude-deck/`. Built on [[Package - runtime]] + [[Package - tiles]],
fed by [[Adapter - Claude Code]] via the [[Broker Contract|broker]].

## Actions

### Info tiles (poll broker ~1s while active)

| Action | Tile | Shows |
|---|---|---|
| Model | KpiTile | model + context % sub |
| Context % | GaugeTile | context window used |
| Status | StatusDot | idle/thinking/tool/awaiting_input/done/error |
| Session Timer | KpiTile | elapsed time + last tool |
| Lines Changed | KpiTile | net lines this session |

### Control keys (press → `hotkey`, keystroke is a PI setting)

Interrupt · Approve · Deny · Plan Mode · Slash Command. See [[Hotkeys & Control]].

### Encoder

Transcript Scroll — rotate = up/down, press = jump to bottom.

## Suggested D200X layout

```
INFO ROW            Model · Context% · $Today* · Status
                    Tokens* · Session · Weekly%* · Lines
CONTROL ROW         Interrupt · Approve · Deny · /compact* · /clear* · Plan
DIALS               Model-switch · Scroll · (spare)
```

\* usage/cost tiles come from the [[Ecosystem Survey|narlei plugins]], placed on
adjacent keys — Claude Deck deliberately doesn't render those.

## Status light logic

Driven by [[Adapter - Claude Code|hooks]]: `UserPromptSubmit→thinking`,
`PreToolUse→tool`, `Notification→awaiting_input`, `Stop→done`,
`SessionStart→idle`. Stale (>30s no write) → dimmed idle.

## Property Inspector

Control actions expose a **Keystroke** field (+ Command for Slash, up/down for
Scroll). This is where the [[Hotkeys & Control|hotkey format]] is calibrated.

## Status

✅ Builds, connects to live Studio, `broker→tiles` verified. ⏳ Physical device
render + hotkey calibration ([[Open Questions]]).
