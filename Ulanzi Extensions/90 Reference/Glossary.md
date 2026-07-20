---
tags: [reference, glossary]
---

# Glossary

- **UlanziDeck / Ulanzi Studio** — the desktop app that drives the deck and loads
  plugins. See [[UlanziDeck Platform]].
- **D200X** — the Ulanzi Creative Deck hardware (keys + dials).
- **Plugin** — a folder (`*.ulanziPlugin`) with a Node entry + manifest. [[Plugin Anatomy]].
- **Action** — a placeable behavior in a plugin (a key or dial type). Has a 5+
  segment UUID.
- **Context** — opaque id of one *placed* button instance (uuid+actionid+key).
- **`$UD`** — the `UlanziApi` object; the plugin's WebSocket link to Studio.
  [[SDK and $UD API]].
- **Keypad / Encoder** — the two `Controllers`: a press key vs a dial.
- **Property Inspector (PI)** — the per-key settings WebView page.
- **keylist** — the (undocumented) string passed to `$UD.hotkey`. [[Hotkeys & Control]].
- **Tile** — an SVG key face produced by [[Package - tiles]].
- **Broker** — the `~/.ulanzi-ai/<app>.json` state contract. [[Broker Contract]].
- **Adapter** — a per-AI-tool script that fills the broker. [[Future Adapters]].
- **Foundation** — the `ulanzi-lab` packages + tooling. [[ulanzi-lab Monorepo]].
