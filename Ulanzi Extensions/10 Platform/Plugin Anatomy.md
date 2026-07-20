---
tags: [platform, reference]
---

# Plugin Anatomy

```
com.<vendor>.<slug>.ulanziPlugin/     ← folder: any unique id ending .ulanziPlugin
├── manifest.json                     ← metadata + Actions[]
├── dist/app.js                       ← CodePath: the bundled Node entry (runs)
├── property-inspector/inspector.html ← per-key settings UI (a WebView page)
├── libs/{js,css}/                    ← browser SDK for the PI (global $UD)
└── resources/*.png                   ← manifest/action icons (NOT the live face)
```

## manifest.json — the parts that matter

- `UUID` — main service, **4 segments** (e.g. `com.ulanzi.ulanzideck.claudedeck`).
- `CodePath` — the built entry, `dist/app.js`.
- `Actions[]` — each has `UUID` (**5+ segments**, prefixed by main), `Name`,
  `Icon`, `States[]`, `Controllers` (`["Keypad"]` and/or `["Encoder"]`), optional
  `PropertyInspectorPath`.
- Full rules + validation: [[Conventions & Footguns]].

## Two runtimes

| | Plugin process | Property Inspector |
|---|---|---|
| Where | `dist/app.js` (Node v20) | `property-inspector/*.html` (WebView) |
| `$UD` build | node (`ws`) | browser (global, `document`) |
| Job | render keys, handle events | edit per-key settings |
| Talk to each other | `sendToPropertyInspector` ⇄ `sendToPlugin` / settings |

## The live face vs the icons

`resources/*.png` only appear in Studio's action list. The **live key face** is
drawn at runtime via `setBaseDataIcon` — see [[Rendering Keys]].

## In ulanzi-lab

You author `src/app.js` (using [[Package - runtime]]); [[Tooling|build]] bundles it
to `dist/app.js`. The [[Tooling|scaffold generator]] stamps this whole structure.

Related: [[SDK and $UD API]] · [[Claude Deck]]
