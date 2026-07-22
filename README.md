# ulanzi-lab

[![CI](https://github.com/peersclub/ulanzi-extensions/actions/workflows/ci.yml/badge.svg)](https://github.com/peersclub/ulanzi-extensions/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A reusable foundation for building **UlanziDeck (Ulanzi D200X)** plugins, plus
the flagship **Claude Deck** plugin: live Claude Code session activity + two-way
control on your deck.

> Turn your Ulanzi deck into a power-user surface for AI coding tools — see which
> model/session is running, context %, a status light across terminals, and
> control keys — with a foundation that makes new plugins cheap to build.

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
  same schema and Claude Deck's tiles work unchanged. Each info key has an
  **App source** setting (`claude-code` / `cursor` / `codex`) in its Property
  Inspector, so one deck can mix tools.

## Contributing

Contributions welcome — **you don't need the hardware** to work on packages,
tiles, adapters, or tests. See **[CONTRIBUTING.md](CONTRIBUTING.md)** and
**[docs/CONVENTIONS.md](docs/CONVENTIONS.md)**. Good first areas: a new
[tile](packages/tiles), a new AI-tool [adapter](adapters), or a new plugin
(`node tools/scaffold/new-plugin.mjs <name>`).

## License

MIT — see [LICENSE](./LICENSE). Vendored Ulanzi SDK code under `vendor/` is
Apache-2.0 (see `vendor/NOTICE.md`).
