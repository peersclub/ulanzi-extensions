---
tags: [foundation]
---

# ulanzi-lab Monorepo

The reusable foundation. A pnpm workspace at the repo root.

## Layout

```
packages/  sdk · runtime · tiles · broker      ← the reuse engine
plugins/   claude-deck                         ← flagship plugin
adapters/  claude-code                         ← feeds the broker
tools/     dev · build · package · scaffold · make-icon
docs/      CONVENTIONS.md · ONBOARDING.md
.claude/skills/ulanzi-plugin                   ← lets Claude keep building
Ulanzi Extensions/                             ← this vault
```

## Quickstart

```bash
pnpm install
pnpm test                 # broker + tiles unit tests
pnpm dev                  # Claude Deck: build + symlink + watch
pnpm package              # -> plugins/<uuid>.ulanziPlugin.zip
```

## The packages (bottom-up)

1. [[Package - sdk]] — official UlanziApi + TS types.
2. [[Package - runtime]] — `defineAction` / `definePlugin` + auto-polling.
3. [[Package - tiles]] — SVG key faces.
4. [[Package - broker]] — the [[Broker Contract|state contract]].

A plugin depends on these via `workspace:*`; [[Tooling|esbuild]] bundles them into
one `dist/app.js` (no `node_modules` shipped).

## Why a monorepo

One place for shared code + the plugins that use it, with a single dev loop and
test command. Adding a plugin = `tools/scaffold/new-plugin.mjs` then `pnpm dev`.
See [[Tooling]] and [[Roadmap & Phases]].
