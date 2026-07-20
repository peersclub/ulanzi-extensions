---
tags: [reference]
---

# Ecosystem Survey

What's already installed on this Mac (`~/Library/Application Support/Ulanzi/
UlanziDeck/Plugins/`). These shaped the [[Project Snapshot|scope decision]] and are
the best reference implementations.

## Directly relevant (AI tools)

| Plugin | UUID | What it does |
|---|---|---|
| **Claude Code Usage** | `com.narlei.claudeusage.plugin` | 5-hour + weekly limits per Claude account, from config dir + macOS Keychain, color-coded. **Owns usage** — Claude Deck doesn't. |
| **AI Cost Monitor** | `com.narlei.aicost.plugin` | Spend across Claude/Codex/Cursor/Gemini/Copilot via open-source **codeburn**. **Owns cost.** |

> [!important] Scope consequence
> Because these exist and you use them, [[Claude Deck]] deliberately builds only
> the **unbuilt** half — live session activity + control. No duplication.

## Best code references

| Plugin | Why study it |
|---|---|
| **`com.claude.usage`** | current idiom: `plugin-common-node`, per-`context` map, jittered polling, hand-rolled SVG renderer. Source of our official `apiTypes.d.ts`. |
| **`com.ulanzi.stock`** | official polling-data plugin; webpack bundle → `dist/app.js`, SVG via svgdotjs. |

## Author to watch

**Narlei Moreira** — the `com.narlei.*` family (claudeusage, aicost, ticktick,
youtubestats, speedtest). Active, modern SDK usage.

## Takeaways baked into ulanzi-lab

- Bundle to a single `dist/app.js`, ship no `node_modules` (well, ws inline).
- SVG data-URIs for key faces ([[Rendering Keys]]).
- Store per-key config as JSON in the plugin's own folder / broker.
