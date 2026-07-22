# UlanziDeck plugin conventions & footguns

Everything here was learned by dissecting the real installed plugins
(`com.ulanzi.stock`, `com.claude.usage`) — not docs. Treat it as ground truth.

## Anatomy of a plugin

```
com.<vendor>.<slug>.ulanziPlugin/     ← folder name: any unique id ending .ulanziPlugin
├── manifest.json                     ← metadata + Actions[]
├── dist/app.js                       ← CodePath: the bundled Node entry (what runs)
├── property-inspector/inspector.html ← settings UI (a WebView page)
├── libs/{js,css}/                    ← browser SDK for the PI (global $UD)
└── resources/*.png                   ← manifest/action icons (NOT the live key face)
```

- The **plugin runs as a Node v20 process** (`CodePath`), speaking WebSocket to
  UlanziDeck on `ws://127.0.0.1:3906`.
- The **Property Inspector is a browser page**, using a different `$UD` build
  (global, `document`-based) loaded via `<script>` tags from `libs/js`.

## UUID rules (silent failures if wrong)

- **Main service UUID = exactly 4 dot-segments**, e.g. `com.ulanzi.ulanzideck.claudedeck`.
  The SDK decides "am I the main service?" by counting segments == 4.
- **Action UUID = 5+ segments**, and must start with the main UUID + ".".
- Folder name is independent of the UUID; just end it in `.ulanziPlugin`.
- `tools/package.mjs` enforces all of the above before zipping.

## Rendering a key face

The key image is **SVG passed as a base64 `data:` URI** to `setBaseDataIcon` —
there is no canvas and no native module. Use `@ulanzi-lab/tiles`:

```js
b.setIcon(KpiTile({ title: "Model", value: "sonnet", sub: "62% ctx" }));
```

Canvas size is **200×200**. `resources/*.png` are only for the deck's action
list, never the live face.

> [!warning] QSvg (SVG Tiny 1.2) only — verified on-device
> Ulanzi Studio renders keys with Qt's QSvg engine, which implements **SVG Tiny
> 1.2**. Anything outside that spec makes the key render **blank / fall back to
> the static icon** (the "just colored" symptom). Known landmines:
> - **No 8-digit hex colors** (`#RRGGBBAA`). Use `rgba(r,g,b,a)` instead. This one
>   cost a debugging session; there's a regression test in `packages/tiles`.
> - Prefer `rgba()` / 6-digit hex, basic shapes, `<text>`, `<polyline>`. Avoid
>   CSS Color 4, filters, and modern SVG2 features.
> The tile kit already complies; keep new tiles inside SVG Tiny 1.2.

## Runtime idiom

Use `@ulanzi-lab/runtime` (`defineAction` / `definePlugin`) instead of hand-rolling
the per-`context` instance map. Lifecycle:

| Handler | Fires when |
|---|---|
| `active(b)` | key becomes visible (start polling here — `b.every(ms, fn)`) |
| `inactive(b)` | key hidden (timers auto-cleared for you) |
| `run(b)` | Keypad press |
| `dial(b, ticks)` / `dialDown(b)` | Encoder rotate / press |
| `settings(b, s)` | Property Inspector saved settings |

`b.every()` only runs while active and tears down automatically — never leak an
interval again.

## Hotkeys — the one on-device calibration point

`$UD.hotkey(keylist)` asks UlanziDeck to send a keystroke to the **focused
window**. The exact `keylist` string format is **not documented in any shipped
plugin** and must be confirmed on the device. Because of this:

- **Every control key reads its `keylist` from Property Inspector settings.**
  Defaults (`escape`, `enter`, `shift+tab`, …) are guesses; if one doesn't fire,
  edit it in the inspector — no rebuild.
- Text (e.g. typing `/compact`) may not be expressible as a single combo. If so,
  fall back to a clipboard-paste approach or a saved UlanziDeck text action.

## Dev loop

```bash
pnpm dev                # build + symlink into Plugins/ + esbuild watch
# edit src/… → dist/app.js rebuilds → reload the plugin in UlanziDeck
```

The Plugins entry is a **symlink** to the repo folder, so there's no copy step.
After a rebuild, reload the plugin in UlanziDeck (or toggle the profile) to pick
up the new `dist/app.js`. The Node process is (re)spawned by UlanziDeck.

## Bundling

`tools/build.mjs` uses esbuild: ESM, `platform:node`, bundles workspace packages
**and `ws`** into one `dist/app.js` (no `node_modules` shipped). `bufferutil` /
`utf-8-validate` are external (ws's optional native speedups; absent is fine). A
`createRequire` banner satisfies any leftover `require` in ws internals.

## Gotchas checklist

- [ ] Main UUID 4 segments, action UUIDs 5+ and prefixed by it.
- [ ] `CodePath` points at the **built** `dist/app.js`, not `src/`.
- [ ] Info tiles start polling in `active`, not at module top-level.
- [ ] Don't put usage/cost tiles here — the narlei plugins own those.
- [ ] PI page includes all 5 `libs/js/*.js` scripts before `inspector.js`.
