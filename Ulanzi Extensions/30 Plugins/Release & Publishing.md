---
tags: [plugin, release, publishing]
---

# Release & Publishing

## v1.0.1 (2026-07-24) — "Focus-follow you can trust"

https://github.com/peersclub/ulanzi-extensions/releases/tag/v1.0.1 — the
[[Focus Follow]] reliability layer (2h window, keepalive, crash guards, pin
auto-release) + store-listing compliance. The community-store bot picks up the
latest release, so a merge of issue #42 ships this build.

## v1.0.0 (2026-07-24)

- **GitHub release:** https://github.com/peersclub/ulanzi-extensions/releases/tag/v1.0.0
- Asset: `com.ulanzi.ulanzideck.claudedeck.ulanziPlugin.zip` (~203 KB) —
  **self-contained**: bundles the Claude Code adapter + `INSTALL.md` (unzip into
  the Plugins dir, run `adapter/install.mjs --apply`, restart sessions). A store
  user never touches the monorepo.

## Distribution channels

| Channel | Status | Notes |
|---|---|---|
| GitHub release | ✅ live | direct download |
| **Community Store** (narlei) | 🟡 submitted | [issue #42](https://github.com/narlei/ulanzicommunitystore/issues/42) — bot validates, opens registry PR; live on merge |
| **Official Ulanzi store** | ✉️ email drafted | no self-serve portal; `ustudioservice@ulanzi.com` — draft at `docs/official-submission-email.md`, user sends |

## Store compliance (community)

- Plugin folder at repo **root**: `com.ulanzi.ulanzideck.claudedeck.ulanziPlugin/`
  (manifest + resources; synced copy of the packaged plugin)
- Release asset named exactly `com.<vendor>.<plugin>.ulanziPlugin.zip`
- `store.json` at root: cover (`resources/cover.png`, generated via the
  SVG→qlmanage pipeline), longDescription, `deviceTypes: [deck, dial]`, tags

## Known submission risk

Our UUID squats Ulanzi's namespace (`com.ulanzi.ulanzideck.*` — copied from
their first-party plugins). The official-store email proactively offers to
re-namespace; it's a mechanical rename if requested.

## Icons

All 31 actions have designed icons (SVG authored in the tile aesthetic →
rasterized via macOS `qlmanage`, no native deps): shapes for gauges/radar/
speedometer/fleet, amber bar = contextual keys, grey arc = dials, monospace
command pills for the [[Claude Deck|command row]]. `node tools/gen-icons.mjs`
regenerates everything and rewires the manifest.

Related: [[Claude Deck]] · [[Roadmap & Phases]]
