# Contributing to ulanzi-extensions

Thanks for helping build deck extensions for AI coding tools! This guide gets you productive fast.

## You don't need the hardware to contribute

Most work — packages, tiles, adapters, tests — runs without an Ulanzi deck:

```bash
pnpm install
pnpm test            # broker + tiles unit tests
pnpm build           # bundle the Claude Deck plugin
```

You only need a real **Ulanzi D200X + Ulanzi Studio** to see tiles on physical
keys or to test hotkey control. If you have them, `pnpm dev` symlinks the plugin
into Studio's plugin folder and watches for rebuilds.

## Project layout

```
packages/  sdk · runtime · tiles · broker      # the reusable foundation
plugins/   claude-deck                          # the flagship plugin
adapters/  claude-code · cursor(stub)           # feed the broker
tools/     dev · build · package · scaffold
docs/      CONVENTIONS.md (READ THIS) · ONBOARDING.md
```

Start with **[docs/ONBOARDING.md](docs/ONBOARDING.md)** for a tour and
**[docs/CONVENTIONS.md](docs/CONVENTIONS.md)** for the rules that matter.

## Rules that will save you a debugging session

These were learned the hard way on real hardware (all in `CONVENTIONS.md`):

- **Ulanzi Studio renders SVG with Qt's QSvg (SVG Tiny 1.2).** No 8-digit hex
  colors (`#RRGGBBAA` → blank key), no `textLength`. Use `rgba()` and the
  `fitSize()` helper. There are regression tests guarding both.
- **Main plugin UUID = 4 dot-segments; action UUIDs = 5+**, prefixed by the main.
- **Key faces are SVG data-URIs** via `setBaseDataIcon`, drawn at runtime — the
  `resources/*.png` are only for Studio's action list.

## Common contributions

- **A new tile** → add to `packages/tiles/index.js` (return `toDataUrl(svg)`,
  200×200, use `fitSize`), add a snapshot-style test.
- **A new plugin** → `node tools/scaffold/new-plugin.mjs <name>`.
- **A new AI-tool adapter** (Cursor, Codex, …) → fill the broker schema
  (`packages/broker/index.d.ts`); see `adapters/cursor/README.md`. The deck needs
  no changes — its tiles are app-configurable.

## Before opening a PR

1. `pnpm test` passes (CI runs it too).
2. `pnpm build` succeeds.
3. New rendering code respects the QSvg constraints above.
4. Keep commits focused; describe *why*, not just *what*.

## Reporting bugs

Include: what you did, what you expected, what happened, and — for render issues
— the tile/action and (if possible) the SVG produced. Enable plugin logging with
`ULANZI_DEBUG=1` (writes `~/.ulanzi-ai/claude-deck.log`).

## License

By contributing you agree your work is licensed under the repo's [MIT License](LICENSE).
Vendored Ulanzi SDK code under `vendor/` remains Apache-2.0 (`vendor/NOTICE.md`).
