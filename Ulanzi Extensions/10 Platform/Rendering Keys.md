---
tags: [platform, rendering]
---

# Rendering Keys

## The mechanism

A key face is an **SVG string → base64 → `data:image/svg+xml;base64,…` →
`setBaseDataIcon(context, uri)`**. Confirmed from Ulanzi's own `stock` and
`claudeusage` plugins. Consequences:

- **No canvas, no native modules.** Pure strings bundle into one `dist/app.js`.
- Canvas is **200×200**.
- Text can be SVG `<text>` (no bundled font needed for system fonts).

## Use the tile kit

Don't write raw SVG in actions — use [[Package - tiles]]:

```js
import { KpiTile, GaugeTile, StatusDot } from "@ulanzi-lab/tiles";
b.setIcon(KpiTile({ title: "Model", value: "sonnet", sub: "62% ctx" }));
b.setIcon(GaugeTile({ label: "Context", pct: 62 }));
b.setIcon(StatusDot({ status: "thinking" }));
```

Available tiles: `KpiTile`, `GaugeTile`, `StatusDot`, `SparkTile`, `ActionTile`.
Shared `palette` (Claude orange `#d77757`, bg `#1f1f23`, status colors).

## Adding a new tile

Add a function in `packages/tiles/index.js` that returns `toDataUrl(svgString)`.
Keep the 200×200 viewBox and use the `label()` helper (shadowed text). Snapshot
it in `index.test.mjs` (assert it decodes to well-formed SVG).

## Why this matters

The highest-risk idea (rich gauges/sparklines) was de-risked by choosing SVG:
the *baseline* needs nothing exotic, and richer visuals are just more SVG. See
the decision in [[Architecture]].

Related: [[Package - tiles]] · [[Conventions & Footguns]]
