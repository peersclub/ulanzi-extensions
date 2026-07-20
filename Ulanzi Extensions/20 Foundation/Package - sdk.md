---
tags: [foundation, package]
---

# Package - sdk

`@ulanzi-lab/sdk` — the official UlanziDeck `plugin-common-node` runtime, vendored
and **typed**.

## Contents

- `index.js` — re-exports `UlanziApi`, `Utils`, `RandomPort` (the real Ulanzi code).
- `libs/` — the shipped SDK (`ulanziApi.js`, `utils.js`, `constants.js`, `randomPort.js`).
- `apiTypes.d.ts` — **official** event/payload types (found on-disk in
  `com.claude.usage`).
- `index.d.ts` — a hand-written typed facade over `UlanziApi` so `$UD.*` gets
  autocomplete (methods + event callbacks).
- Dependency: `ws`.

## Why vendored, not npm

Ulanzi doesn't publish the SDK to npm; the source of truth is the code inside
installed plugins. We vendored the current build so the foundation binds to what
Studio actually runs, not a README. See [[Ecosystem Survey]].

## Usage

You normally consume it through [[Package - runtime]], which wraps it. Direct use:

```js
import UlanziApi from "@ulanzi-lab/sdk";
const $UD = new UlanziApi();
$UD.connect("com.ulanzi.ulanzideck.foo");
```

Full surface: [[SDK and $UD API]].
