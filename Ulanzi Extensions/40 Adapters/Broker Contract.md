---
tags: [adapter, contract, reference]
---

# Broker Contract

The normalized schema every adapter writes and every deck plugin reads. File:
`~/.ulanzi-ai/<app>.json`. Implementation: [[Package - broker]].

## Schema (`AiState`)

```jsonc
{
  "app":          "claude-code",   // source tool id
  "model":        "sonnet",        // short label
  "status":       "thinking",      // idle|thinking|tool|awaiting_input|done|error
  "contextPct":   62,              // 0-100
  "costSession":  4.18,            // USD this session
  "sessionSecs":  1421,            // duration
  "linesChanged": 312,             // net lines this session
  "lastTool":     "Edit",          // most recent tool
  "cwd":          "/path/...",     // working dir
  "note":         "",              // free text for a tile
  "ts":           1721480000000    // last write (ms) → staleness
}
```

All fields optional — a partial adapter (e.g. statusline knows model but not
tokens) still produces valid state. `ts` drives the `stale` flag (>30s).

## SessionStatus → visuals

Maps to [[Package - tiles|statusStyle]]: `idle` ○ dim · `thinking` ✳ info ·
`tool` ⚙ accent · `awaiting_input` ! warn · `done` ✓ good · `error` ✕ crit.

## Rules for adapters

- **Merge, don't overwrite** — use `writeState(app, patch)` so partial writers
  compose (statusline writes metrics; hooks write status).
- **Write atomically** — tmp-then-rename (the helper does this).
- **Stamp `ts` every write** — freshness matters more than history.

Consumers: [[Claude Deck]]. Producers: [[Adapter - Claude Code]], [[Future Adapters]].
