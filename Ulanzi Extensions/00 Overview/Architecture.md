---
tags: [overview, architecture]
---

# Architecture

## The big picture

```
┌──────────────────┐   writes    ┌─────────────────┐   reads    ┌────────────────┐
│ AI-app adapters  │ ──────────▶ │ Broker          │ ─────────▶ │ Deck plugin    │
│ (Claude Code,    │ normalized  │ ~/.ulanzi-ai/   │  poll/     │ (Node process) │
│  Cursor, Codex…) │  schema     │ <app>.json      │  watch     │ → SVG on keys  │
└──────────────────┘             └─────────────────┘            └────────────────┘
        ▲                                                                │
        │ statusline + hooks                                             │ WebSocket
        │                                                        ws://127.0.0.1:3906
   Claude Code                                                      UlanziDeck / Studio
```

## Why decouple through a broker

The deck plugin never learns tool-specific details. It reads the
[[Broker Contract|normalized schema]] only. Each AI tool gets a thin
[[Future Adapters|adapter]] that fills the *same* shape → adding a tool is one
adapter, zero plugin changes. This is how the "any AI coding app" goal falls out
for free.

## Two runtimes in one plugin

- **Plugin process** ([[Package - runtime]]) — Node v20, talks [[SDK and $UD API|$UD]]
  over WebSocket, renders keys.
- **Property Inspector** — a browser page for per-key settings, using the
  browser build of `$UD`. See [[Plugin Anatomy]].

## The reuse engine

`ulanzi-lab` packages, bottom-up:

- [[Package - sdk]] — the raw UlanziApi + types.
- [[Package - runtime]] — ergonomic `defineAction` / `definePlugin` + auto-polling.
- [[Package - tiles]] — SVG key faces.
- [[Package - broker]] — the contract above.

A plugin composes these; [[Tooling]] bundles it into a single `dist/app.js`.

## Key design decisions

- **SVG, not canvas** — keys accept SVG data-URIs, so no native modules; the whole
  plugin bundles into one file. See [[Rendering Keys]].
- **Control keystrokes are settings, not code** — the [[Hotkeys & Control|hotkey format]]
  is device-specific and unverified, so it's a Property Inspector field.
- **Foundation-first** — pay DX once so [[Plugin Catalog & Ideas|future plugins]] are cheap.
