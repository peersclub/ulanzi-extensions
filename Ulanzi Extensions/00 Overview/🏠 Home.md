---
tags: [moc, home]
---

# 🏠 Ulanzi Extensions

Knowledge hub for building **Ulanzi D200X (UlanziDeck)** extensions — turning the
deck into a power-user control surface for AI coding tools, starting with Claude Code.

> [!info] What this vault documents
> The whole effort: the platform, the reusable **[[ulanzi-lab Monorepo|ulanzi-lab]]**
> foundation, the **[[Claude Deck]]** plugin, the adapters that feed it, and the
> roadmap for other AI tools. Code lives in the repo root; this vault is the "why"
> and the "how".

## Start here

- New to the project → [[Project Snapshot]]
- Building a plugin → [[Conventions & Footguns]] then [[Plugin Anatomy]]
- Understanding the design → [[Architecture]]

## Map of content

### Platform
- [[UlanziDeck Platform]] — the device, Studio, where plugins live
- [[SDK and $UD API]] — the runtime API surface
- [[Plugin Anatomy]] — folder layout, manifest, runtime vs property inspector
- [[Conventions & Footguns]] — the rules that cause silent failures
- [[Rendering Keys]] — SVG tiles, the 200×200 canvas
- [[Hotkeys & Control]] — the one on-device unknown

### Foundation — ulanzi-lab
- [[ulanzi-lab Monorepo]] — overview + quickstart
- [[Package - sdk]] · [[Package - runtime]] · [[Package - tiles]] · [[Package - broker]]
- [[Tooling]] — dev loop, build, package, scaffold

### Plugins
- [[Claude Deck]] — the flagship (live session activity + control)
- [[Fleet Deck]] — Codex-Micro-style: one key per live session, press to pin
- [[Release & Publishing]] — v1.0.0, store submissions, self-contained zip
- [[Plugin Catalog & Ideas]] — future extensions

### Adapters & data
- [[Broker Contract]] — the app-agnostic state schema
- [[Adapter - Claude Code]] — statusline + hooks
- [[Multi-Session & Naming]] — many terminals, follow the one you're using
- [[Focus Follow]] — the deck tracks your focused tab (exact tty matching)
- [[Performance & Feedback]] — 7ms fast-path, press echo, latency table
- [[Future Adapters]] — Cursor, Codex, Gemini, Copilot

### Roadmap & reference
- [[Roadmap & Phases]] · [[Open Questions]]
- [[Dynamic & Engaging Deck]] — phase-reactive vision + plan-mode showpiece
- [[Ecosystem Survey]] — what's already installed (narlei plugins, etc.)
- [[Glossary]]

## Status at a glance

| Area | State |
|---|---|
| Foundation packages | ✅ built + unit-tested (22 tests) |
| Claude Deck plugin | ✅ **v1.0.0 released** — 31 verified actions |
| Physical D200X validation | ✅ rendering, hotkeys (y/n), dials, focus-follow all proven |
| Publishing | 🟡 [[Release & Publishing\|GitHub live · Community Store pending · official email drafted]] |
| Last calibration item | `enter` submit token — [[Open Questions]] #7 |

See [[Roadmap & Phases]] for what's next.
