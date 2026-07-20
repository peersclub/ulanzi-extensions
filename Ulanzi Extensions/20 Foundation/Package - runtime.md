---
tags: [foundation, package]
---

# Package - runtime

`@ulanzi-lab/runtime` — ergonomic layer over [[Package - sdk|$UD]]. Turns the
hand-rolled boilerplate (per-`context` instance map, jittered polling, event
routing) that every reference plugin repeats into a declarative API.

## API

```js
import { definePlugin, defineAction } from "@ulanzi-lab/runtime";

const Status = defineAction({
  uuid: "com.ulanzi.ulanzideck.claudedeck.status",
  active(b)   { b.every(1000, () => b.setIcon(/* … */)); },  // polling starts here
  inactive(b) { /* timers auto-cleared */ },
  run(b)      { b.hotkey(b.settings.keylist || "escape"); },
  dial(b, t)  { /* encoder */ },
  settings(b, s) { /* PI settings */ },
});

definePlugin({ uuid: "com.ulanzi.ulanzideck.claudedeck", actions: [Status] }).start();
```

## The `Button` object

Each placed key = one `Button` (`b`), one per `context`:

- `b.setIcon(dataUri)` / `b.setStateIcon(i)` — render.
- `b.hotkey(key)`, `b.toast(msg)` — commands.
- `b.every(ms, fn, {jitter, leading})` — poll **only while active**, auto-torn-down.
- `b.save(patch)` — persist settings.
- `b.state` — per-instance scratch; `b.settings` — PI settings.

## Lifecycle handlers

`active` · `inactive` · `run` · `dial` · `dialDown` · `settings`. The host maps
raw `$UD` events to these and routes by `decodeContext(context).uuid`.

## Design note

`b.every` is the anti-footgun: it ties polling to the active lifecycle so you can
never leak an interval (the mistake that's easy to make with raw `setInterval`).

Related: [[Package - tiles]] · [[Plugin Anatomy]]
