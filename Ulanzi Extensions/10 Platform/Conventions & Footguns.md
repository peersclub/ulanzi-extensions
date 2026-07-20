---
tags: [platform, reference, gotchas]
---

# Conventions & Footguns

> [!note] Canonical copy
> Lives in the repo at `docs/CONVENTIONS.md` (shipped with the code). This note
> mirrors it for browsing; keep them in sync.

Everything here was learned by dissecting real installed plugins — not docs.

## UUID rules (silent failures if wrong)

- Main service UUID = **exactly 4** dot-segments.
- Action UUID = **5+** segments, and must start with `mainUUID + "."`.
- Folder name is independent of UUID — just end it in `.ulanziPlugin`.
- `tools/package.mjs` enforces all of this before zipping.

## Rendering

- Key faces are **base64 SVG data-URIs** via `setBaseDataIcon`. No canvas, no
  native modules → the whole plugin bundles into one `dist/app.js`. See [[Rendering Keys]].
- Canvas is **200×200**. `resources/*.png` are for the action list only.

## Runtime

- Start polling in `active(b)` with `b.every(ms, fn)` — it auto-tears-down on
  inactive, so intervals never leak.
- `CodePath` must point at built `dist/app.js`, never `src/`.

## Property Inspector

- Include all 5 `libs/js/*.js` before `inspector.js`.
- The deck echoes `setSettings` back via `didReceiveSettings`; ignore your own
  echo or you'll clobber the field mid-type.

## Hotkeys

- `$UD.hotkey(keylist)` format is **device-specific & undocumented** → always a
  Property Inspector setting, never hardcoded. See [[Hotkeys & Control]].

## Checklist before shipping

- [ ] Main UUID 4 segments; action UUIDs 5+ and prefixed.
- [ ] `CodePath` → `dist/app.js`.
- [ ] Info tiles poll in `active`, not at module top level.
- [ ] No usage/cost tiles (the [[Ecosystem Survey|narlei plugins]] own those).
