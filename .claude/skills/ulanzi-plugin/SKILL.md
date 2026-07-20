---
name: ulanzi-plugin
description: Build or modify UlanziDeck (Ulanzi D200X) plugins in the ulanzi-lab monorepo. Use when creating a new deck plugin, adding actions/tiles, wiring an AI-tool adapter, or debugging why a plugin/key isn't rendering. Knows the SDK conventions, the live-reload loop, and the footguns.
---

# Building UlanziDeck plugins (ulanzi-lab)

This repo is a foundation: don't hand-roll SDK plumbing — compose the packages.

## Mental model

- A plugin = a Node process (`dist/app.js`) that talks WebSocket to UlanziDeck,
  plus a browser Property Inspector page for settings.
- Key faces are **SVG data-URIs** via `setBaseDataIcon` (no canvas). Use
  `@ulanzi-lab/tiles`.
- Live cross-tool data flows through the **broker** (`~/.ulanzi-ai/<app>.json`):
  adapters write it, plugins read it. Keep plugins tool-agnostic.

## To add a plugin

```bash
node tools/scaffold/new-plugin.mjs <kebab-name>
pnpm install
# add "<name>": "<UUID>.ulanziPlugin" to DIR_NAME in tools/dev.mjs
node tools/dev.mjs <name>
```

## To add an action to an existing plugin

1. Add an entry to `manifest.json` `Actions[]` — UUID = mainUUID + "." + suffix
   (**5+ segments total**), `Controllers: ["Keypad"]` or `["Encoder"]`.
2. In `src/app.js`, `defineAction({ uuid, active, run, dial, settings })` and add
   it to `definePlugin({ actions: [...] })`.
3. Info tile? start polling in `active`: `b.every(1000, () => b.setIcon(Tile(...)))`.
   Control key? `run(b){ b.hotkey(b.settings.keylist || "escape") }`.

## Rules that cause silent failures (see docs/CONVENTIONS.md)

- Main UUID **exactly 4** dot-segments; action UUIDs **5+**, prefixed by main.
- `CodePath` must point at built `dist/app.js`.
- PI page must load all 5 `libs/js/*.js` before `inspector.js`.
- `$UD.hotkey(keylist)` format is device-specific & undocumented → always make
  it a PI setting; never hardcode.

## Verify without the device

- `pnpm test` (broker + tiles).
- Render check: read broker state + call a tile fn, assert it returns
  `data:image/svg+xml;base64,` (see how the adapter chain was validated).
- `node plugins/<name>/dist/app.js` briefly — a `MAIN WEBSOCKET OPEN` line means
  it connected to a running UlanziDeck.

## Reference implementations on disk

Real installed plugins live in
`~/Library/Application Support/Ulanzi/UlanziDeck/Plugins/`. `com.claude.usage`
and `com.ulanzi.stock` are the best examples of the current idiom.
