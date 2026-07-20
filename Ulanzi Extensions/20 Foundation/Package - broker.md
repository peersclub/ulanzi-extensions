---
tags: [foundation, package]
---

# Package - broker

`@ulanzi-lab/broker` — the app-agnostic state contract that decouples AI tools
from the deck. Full schema in [[Broker Contract]].

## Files & API

- State lives at `~/.ulanzi-ai/<app>.json` (`BROKER_DIR`).
- `writeState(app, patch, now?)` — merge-write; preserves existing fields, stamps
  `ts`, **atomic** (write-tmp-then-rename so readers never see a half file).
- `readState(app, now?)` — sync read; adds `stale: true` past `STALE_MS` (30s).
- `watchState(app, onChange)` — fs.watch with debounce + re-arm if the file
  doesn't exist yet; returns an unwatch fn.

## Who uses it

- **Adapters write** it — e.g. [[Adapter - Claude Code]].
- **The deck reads** it — [[Claude Deck]] info tiles poll `readState("claude-code")`.

## Note on the adapter copy

The Claude Code adapter ships a **self-contained** `broker-write.mjs` (not this
package) because it's wired into `~/.claude` and must survive the repo moving. It
mirrors this contract exactly. See [[Adapter - Claude Code]].

## Tested

`packages/broker/index.test.mjs` — merge semantics, staleness threshold,
missing-file → null.
