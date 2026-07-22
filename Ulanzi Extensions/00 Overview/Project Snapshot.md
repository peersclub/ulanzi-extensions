---
tags: [overview]
---

# Project Snapshot

## The goal

Make the **Ulanzi D200X Creative Deck** a power-user surface for AI coding tools.
When working in Claude Code, the deck shows live session info and offers two-way
control — and the same design generalizes to any AI coding app via [[Future Adapters|adapters]].

## The shape of the solution

Two products joined by a contract:

1. **[[ulanzi-lab Monorepo|ulanzi-lab]]** — a reusable foundation so *any* deck
   plugin is cheap to build (typed SDK, declarative runtime, SVG tiles, dev loop).
2. **[[Claude Deck]]** — the flagship plugin built on it.

They're decoupled by the **[[Broker Contract]]**: adapters write a normalized
state file, the deck reads it. See [[Architecture]].

## Scope decision (important)

Read-only **usage/cost monitoring is out of scope** — the installed
[[Ecosystem Survey|narlei plugins]] (`claudeusage`, `aicost`) already do it well.
Claude Deck focuses on the *unbuilt* half:

- **Live session activity** — model, context %, and a status light
  (thinking / awaiting input / done).
- **Two-way control** — interrupt, approve/deny, plan mode, slash commands, dials.

## Where things are

- **Code / repo:** the `ulanzi-lab` repo root
- **This vault:** `ulanzi-lab/Ulanzi Extensions/`
- **Installed plugins on this Mac:** `~/Library/Application Support/Ulanzi/UlanziDeck/Plugins/`
- **Broker state:** `~/.ulanzi-ai/claude-code.json`

## Verified vs pending

- ✅ Plugin connects to live Studio (`MAIN WEBSOCKET OPEN`).
- ✅ `adapter → broker → tiles` chain renders valid SVG.
- ✅ Symlink live-reload loop; unit tests green.
- ⏳ Physical device: key rendering + [[Hotkeys & Control|hotkey keylist format]].

Related: [[Roadmap & Phases]] · [[Open Questions]]
