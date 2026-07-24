---
tags: [roadmap]
---

# Roadmap & Phases

## Shipped 🚀 (2026-07-24)

**v1.0.0 released and submitted to stores** — [[Release & Publishing]].
Along the way: [[Fleet Deck]] (Codex-Micro fleet), [[Focus Follow]] (tty-exact
tab tracking), [[Performance & Feedback]] (7ms hook fast-path, press echo),
smart context-morphing knobs, preset command row, designed icons, and the
curation to verified-only actions.

## Done ✅

- **Foundation** — [[Package - sdk|sdk]], [[Package - runtime|runtime]],
  [[Package - tiles|tiles]], [[Package - broker|broker]]; [[Tooling|dev loop + build + package + scaffold]].
- **[[Claude Deck]]** — info tiles + control keys + scroll dial; connects to live Studio.
- **[[Adapter - Claude Code]]** — statusline + hooks + installer; `broker→tiles` verified.
- **Docs + skill** — `docs/`, this vault, `.claude/skills/ulanzi-plugin`.

## Now ⏳ (needs the physical D200X)

1. Reload the plugin in Studio; drag Claude Deck actions onto keys.
2. `install.mjs --apply`; run a Claude Code session and watch the tiles.
3. **Calibrate [[Hotkeys & Control|hotkeys]]** — the one real unknown.

## Vision

- [[Dynamic & Engaging Deck]] — phase-reactive control surface, plan-mode
  dial-through, animated tiles, clipboard macros.

## Next 🔜

- Resolve `contextPct` source (transcript token count or newer statusline field).
- Slash-command text injection approach (paste vs combo).
- Freeze the [[Broker Contract]] as v1; write a **Cursor adapter**.
- **Universal AI Deck** ([[Plugin Catalog & Ideas]]).

## Later 💡

- Agent Fleet, prompt launcher, context/cost alarms — see [[Plugin Catalog & Ideas]].
- Polish icons (replace placeholder PNGs), localization, publish to the community store.

## Open items

Tracked in [[Open Questions]].
