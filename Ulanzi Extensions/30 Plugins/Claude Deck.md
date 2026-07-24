---
tags: [plugin, flagship]
---

# Claude Deck

The flagship plugin. UUID `com.ulanzi.ulanzideck.claudedeck`. Source in
`plugins/claude-deck/`. Built on [[Package - runtime]] + [[Package - tiles]],
fed by [[Adapter - Claude Code]] via the [[Broker Contract|broker]].

> [!success] Since v1.0.1 (2026-07-24, latest)
> **Account tile** (👤 logged-in email + org, refreshes across /switch-account —
> pairs with the /switch-account command key). **Dashboard v2**: fleet KPI
> header + rich session cards (gauges, dual sparklines, chips, per-card ask
> banner + collapsible plan, CSS pulse animations — the popup is a real web
> view, not QSvg). **Pixel-Claude branding**: the real mascot (12×8 grid) as
> the plugin icon, a breathing **Claude Logo** key, state-colored bouncing/
> breathing Beacon, and a corner source-badge stamped on every Claude-fed tile
> via `brandize()` (tile-agnostic decode→inject→encode).

> [!success] v1.0.0 shipped (2026-07-24) — see [[Release & Publishing]]
> Current inventory (31 actions): 12 live info tiles (incl. Cost, Tokens, Ctx &
> Cost trends), fleet slots + beacon + dashboard, contextual Allow/Deny + plan
> keys, a **preset command row** (/compact /clear /context /cost /resume /model
> /AIUse /switch-account — clipboard ⌘V injection), and three always-alive knobs:
> **Smart Dial** (morphs: plan pending → rotate steps + press approves; else
> rotate sessions + press pins), **Command Dial** (palette on a knob), **Effort
> Dial** (live settings.json write). Dial direction verified on-device after the
> `rotateEvent` fix; knobs wrap instead of clamping. All actions have designed
> icons. [[Focus Follow]] keeps the whole deck on the terminal tab you're in.

> [!success] Curated to fully-functional (2026-07-24)
> The action set was trimmed 30 → 23: removed Interrupt / static Approve+Deny /
> Plan-mode toggle / Slash Command / Transcript Scroll / Always Allow — all
> depended on keystroke tokens never verified on-device (escape, shift+tab,
> arrows, down+enter) or a broken whole-string hotkey send. Every remaining
> action uses a verified mechanism: broker-driven tiles, proven y/n keys,
> clipboard ⌘V (Macro), settings.json writes (Effort Dial), openView (Dashboard).
> They can return if/when their key tokens get calibrated ([[Open Questions]]).

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
