# cursor adapter (stub)

> [!warning] Skeleton, not functional yet
> This is a documented starting point for a Cursor → broker adapter. The data
> sources are TODO — it writes only `app`/`status: idle` today. Build it out when
> you want a Cursor Deck.

Feeds Cursor session state into the broker (`~/.ulanzi-ai/cursor.json`) using the
same [broker contract](../../packages/broker/index.d.ts) as the Claude Code
adapter. Because the deck's info tiles are app-configurable (Property Inspector
"App source" → `cursor`), no plugin changes are needed once this fills the schema.

## What to wire (research needed)

| Broker field | Likely Cursor source |
|---|---|
| `model` | active model selector / settings |
| `status` | agent/composer activity — needs an event or log signal |
| `contextPct` | conversation token usage if exposed |
| `linesChanged` | diff stats for the session |
| `cwd` | workspace root |

Cursor doesn't expose Claude Code-style hooks, so status likely comes from
watching a log/state file or an extension. Investigate:

- `~/Library/Application Support/Cursor/` (logs, workspaceStorage, state.vscdb)
- Any Cursor extension API for composer/agent events.

## Contract reminder

Use merge + atomic writes and stamp `ts` every write (see
`adapters/claude-code/lib/broker-write.mjs` for the exact pattern to copy).
