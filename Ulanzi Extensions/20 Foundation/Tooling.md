---
tags: [foundation, tooling]
---

# Tooling

All in `tools/`. Node ESM, run via `pnpm` scripts.

## dev.mjs — the live-reload loop ⭐

```bash
node tools/dev.mjs [name]        # symlink into Plugins/ + esbuild watch
node tools/dev.mjs --link-only [name]
node tools/dev.mjs --unlink [name]
```

**Symlinks** the repo plugin folder into
`~/Library/Application Support/Ulanzi/UlanziDeck/Plugins/` (refuses to clobber a
real dir). Editing `src/` rebuilds `dist/app.js` in place → reload the plugin in
Studio to pick it up. No copy step. This is the biggest DX win.

## build.mjs — bundling

esbuild: ESM, `platform:node`, target node20. Bundles workspace packages **and
`ws`** into one `dist/app.js`. `bufferutil`/`utf-8-validate` external (ws's
optional native speedups). A `createRequire` banner covers leftover `require`.

## package.mjs — distribution

Validates the manifest (UUID segments, Controllers, CodePath exists), builds, then
zips a clean copy (no `node_modules`/`src`) as `<uuid>.ulanziPlugin.zip`.

## scaffold/new-plugin.mjs — start a plugin

```bash
node tools/scaffold/new-plugin.mjs my-thing
```

Stamps manifest + runtime-based `src/app.js` + PI + icons + workspace deps. Then
add its dir-name to `DIR_NAME` in `dev.mjs` and `pnpm dev my-thing`.

## make-icon.mjs — placeholder PNGs

Pure-Node (zlib) solid-color PNG generator for manifest icon slots. No native deps.

Related: [[ulanzi-lab Monorepo]] · [[Conventions & Footguns]]
