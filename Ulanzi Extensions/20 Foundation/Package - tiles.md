---
tags: [foundation, package]
---

# Package - tiles

`@ulanzi-lab/tiles` — zero-dependency SVG tile kit. Each function returns a
`data:image/svg+xml;base64,…` URI for `setIcon` / `setBaseDataIcon`. 200×200.

## Tiles

| Function | Look | Used for |
|---|---|---|
| `KpiTile({title, value, sub, accent})` | caption + big value | Model, Session, Lines |
| `GaugeTile({label, pct, accent, sub})` | fill bar + % (auto threshold color) | Context % |
| `StatusDot({status, sub, stale})` | colored ring + glyph | Status light |
| `SparkTile({label, values, value})` | mini history line | trends |
| `ActionTile({glyph, caption, accent})` | big glyph + label | control keys |

## Shared bits

- `palette` — `accent` = Claude orange `#d77757`, `bg` `#1f1f23`, plus
  `good/warn/crit/info/dim`.
- `statusStyle` — maps [[Broker Contract|SessionStatus]] → `{color, glyph, label}`.
- `escapeXml`, `toDataUrl`, `SIZE`.

## Extending

Add a function returning `toDataUrl(svg)`; keep the 200×200 viewBox and use the
internal `label()` helper for shadowed text. Snapshot-test in `index.test.mjs`.
Details: [[Rendering Keys]].

## Why zero-dep

SVG strings need no canvas/native modules, so tiles bundle cleanly and the
native-module risk disappears. See [[Architecture]].
