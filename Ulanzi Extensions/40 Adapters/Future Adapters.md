---
tags: [adapter, backlog]
---

# Future Adapters

Each AI coding tool becomes a thin adapter that fills the [[Broker Contract]]. The
deck reads `~/.ulanzi-ai/<app>.json` — so a new tool is **one adapter, zero plugin
changes**.

## Candidates

| Tool | Likely data source | Notes |
|---|---|---|
| **Cursor** | logs / workspace state / extension | status + model; approve is app-specific |
| **Codex CLI** | CLI output / config dir | similar to Claude Code |
| **Gemini CLI** | CLI hooks if available | |
| **GitHub Copilot** | editor telemetry | harder; may be usage-only (see [[Ecosystem Survey|aicost]] uses codeburn) |

## Adapter checklist

- [ ] Pick an `app` id (used as the filename).
- [ ] Find a live signal for `status` (hooks/events) and metrics for
      `model`/`contextPct`/etc.
- [ ] `writeState(app, patch)` — merge, atomic, stamp `ts`.
- [ ] Point a deck at it: either the Universal AI Deck ([[Plugin Catalog & Ideas]])
      or a dedicated plugin.

## Reuse

`aicost`'s open-source **codeburn** already computes spend across Claude/Codex/
Cursor/Gemini/Copilot locally — a good reference (or data source) for cost-aware
adapters. See [[Ecosystem Survey]].
