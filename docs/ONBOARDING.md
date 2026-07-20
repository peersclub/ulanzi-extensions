# Onboarding — your first 10 minutes

A guided tour of ulanzi-lab. Assumes UlanziDeck (Ulanzi Studio) is installed.

## 1. Install & test (2 min)

```bash
pnpm install
pnpm test          # broker + tiles green
```

## 2. Run the Claude Deck dev loop (2 min)

```bash
pnpm dev           # builds, symlinks into UlanziDeck/Plugins, watches src/
```

Open UlanziDeck → you should see a **Claude Deck** category. Drag its **Status**
and **Model** actions onto keys. They'll show `idle` / `—` until the adapter
feeds data.

## 3. Feed live Claude Code state (3 min)

```bash
node adapters/claude-code/install.mjs          # preview the settings.json merge
node adapters/claude-code/install.mjs --apply   # apply (backs up first)
```

Now use Claude Code normally. As you prompt, the **Status** key should move
through thinking → tool → done, and **Model** / **Session** / **Lines** update.

> Context % shows 0 unless your Claude Code build exposes it in the statusline
> payload — see `adapters/claude-code/statusline.mjs`.

## 4. Add control keys & calibrate (3 min)

Drag **Interrupt / Approve / Plan / Slash** onto keys. Each has a **Keystroke**
field in its Property Inspector. Focus your Claude Code terminal and press a key:

- If the default fires, done.
- If not, edit the keystroke (try `esc` vs `escape`, `shift+tab`, `cmd+…`). This
  is the one thing that depends on your specific device — see
  [CONVENTIONS.md § Hotkeys](./CONVENTIONS.md).

## Where things live

| I want to… | Go to |
|---|---|
| Change a tile's look | `packages/tiles/index.js` |
| Add/adjust an action | `plugins/claude-deck/{manifest.json,src/app.js}` |
| Change what data is captured | `adapters/claude-code/{statusline,hook}.mjs` |
| Start a brand-new plugin | `node tools/scaffold/new-plugin.mjs <name>` |
| Understand the rules | `docs/CONVENTIONS.md` |
