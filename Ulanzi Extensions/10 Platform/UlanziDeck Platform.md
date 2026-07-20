---
tags: [platform]
---

# UlanziDeck Platform

## Hardware & software

- **Device:** Ulanzi **D200X Creative Deck** — 14 LCD keys + dials (encoders).
- **Software:** **Ulanzi Studio / UlanziDeck** (macOS 12+). *Not* Elgato Stream
  Deck-compatible — its own ecosystem.
- **Companion:** an "Ulanzi Community Store" app also exists (community plugins).

## Where things live (this Mac)

| Thing | Path |
|---|---|
| Installed plugins | `~/Library/Application Support/Ulanzi/UlanziDeck/Plugins/` |
| Profiles / config | `~/Library/Application Support/Ulanzi/UlanziDeck/` |
| Plugin ⇄ Studio bridge | WebSocket `ws://127.0.0.1:3906` |

## How a plugin runs

Studio launches the plugin's `CodePath` as a **Node v20 process** and connects to
it over WebSocket. The plugin registers as a "main service" (see UUID rules in
[[Conventions & Footguns]]), receives lifecycle events, and pushes key images back.
The API is [[SDK and $UD API|$UD]].

## Multiple plugins coexist

Keys from different plugins live together on one profile. That's why [[Claude Deck]]
can sit next to the [[Ecosystem Survey|narlei usage/cost plugins]] on the same
"Claude" profile without overlap.

## Official SDK

- Repo: `UlanziTechnology/UlanziDeckPlugin-SDK` (Apache-2.0).
- Two SDK builds: **node** (`plugin-common-node`, used by the plugin process) and
  **browser** (`libs/js`, used by the Property Inspector).
- Best on-disk references: `com.claude.usage` and `com.ulanzi.stock` — see
  [[Ecosystem Survey]].

Related: [[Plugin Anatomy]] · [[Architecture]]
