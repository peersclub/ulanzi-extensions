# ulanzi-lab

A reusable foundation for building **UlanziDeck (Ulanzi D200X)** plugins, plus
the flagship **Claude Deck** plugin: live Claude Code session activity + two-way
control on your deck.

## Why this exists

Ulanzi ships an SDK but no ergonomics. This repo pays the DX cost once so new
plugins are cheap: typed `$UD`, a declarative runtime, an SVG tile kit, a broker
contract, and a symlink-based live-reload loop.

```
packages/
  sdk       official plugin-common-node (UlanziApi) + TS types
  runtime   defineAction / definePlugin + auto-managed polling
  tiles     zero-dep SVG tiles (KpiTile, GaugeTile, StatusDot, …)
  broker    normalized AI-session state contract (~/.ulanzi-ai/*.json)
plugins/
  claude-deck   the flagship plugin
adapters/
  claude-code   statusline + hooks that fill the broker
tools/        dev (symlink+watch), build, package, scaffold
docs/         CONVENTIONS.md (footguns), ONBOARDING.md
```

## Quickstart

```bash
pnpm install
pnpm test                     # broker + tiles unit tests

# Claude Deck live-reload dev loop (symlinks into UlanziDeck/Plugins)
pnpm dev                      # == node tools/dev.mjs claude-deck

# Feed live Claude Code state into the broker
node adapters/claude-code/install.mjs           # dry run
node adapters/claude-code/install.mjs --apply    # wire hooks + statusline

# Package for distribution
pnpm package                  # -> plugins/<uuid>.ulanziPlugin.zip
```

Then in UlanziDeck, add Claude Deck's actions (Model, Context %, Status,
Session, Lines, Interrupt, Approve, Deny, Plan, Slash, Scroll) to keys —
alongside your existing **Claude Code Usage** and **AI Cost** plugin keys.

## Build another plugin

```bash
node tools/scaffold/new-plugin.mjs my-thing
```

See **docs/CONVENTIONS.md** for the rules that matter (UUID segments, rendering,
the hotkey calibration point) and **docs/ONBOARDING.md** for a guided tour.

## Design notes

- **Read-only monitoring (usage/cost) is intentionally out of scope** — the
  installed `com.narlei.claudeusage` and `com.narlei.aicost` plugins do it well.
  Claude Deck focuses on the unbuilt half: live session activity + control.
- **The broker is app-agnostic.** Point a new adapter (Cursor, Codex, …) at the
  same schema and Claude Deck's tiles work unchanged.
