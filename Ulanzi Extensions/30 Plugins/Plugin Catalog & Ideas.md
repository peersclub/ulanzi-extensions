---
tags: [plugin, ideas, backlog]
---

# Plugin Catalog & Ideas

Everything buildable on the [[ulanzi-lab Monorepo|foundation]]. ✅ built · 🔜 next · 💡 idea.

## Built

- ✅ [[Claude Deck]] — live Claude Code session activity + control.

## Next (same pattern, new adapter)

- 🔜 **Cursor Deck** — status/model/context for Cursor via a [[Future Adapters|Cursor adapter]].
- 🔜 **Codex Deck** — same, for OpenAI Codex CLI.
- 🔜 **Universal AI Deck** — one plugin, a PI dropdown picks which `<app>.json` to
  read (Claude/Cursor/Codex). The [[Broker Contract]] makes this a config detail.

## Ideas

- 💡 **Agent Fleet** — one key per running agent/session (multiple Claude Code
  windows), each a status light; press to focus that window.
- 💡 **Prompt Launcher** — keys that paste saved prompts/slash-commands.
- 💡 **PR / CI deck** — build on the installed `repostats` pattern.
- 💡 **Model roulette dial** — encoder scrolls model list, press to switch.
- 💡 **Context budget alarm** — key flashes when context % crosses a threshold.
- 💡 **Cost guardrail** — read the [[Ecosystem Survey|aicost]] data, buzz on a daily cap.

## How to start any of these

```bash
node tools/scaffold/new-plugin.mjs <name>
```

Then write a [[Future Adapters|adapter]] if it needs a new data source, or reuse
an existing `<app>.json`. See [[Tooling]] and the `ulanzi-plugin` skill.
