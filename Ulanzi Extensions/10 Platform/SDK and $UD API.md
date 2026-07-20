---
tags: [platform, sdk, reference]
---

# SDK and $UD API

`$UD` is the `UlanziApi` instance — the plugin's connection to Studio. Typed in
`packages/sdk/index.d.ts` (see [[Package - sdk]]). You rarely call it directly;
[[Package - runtime]] wraps it. This note is the raw reference.

## Connection

- `connect(uuid, port=3906, address="127.0.0.1")` — opens the WebSocket. A UUID
  with **exactly 4 dot-segments** ⇒ "main service".
- Events fire as methods you register: `onConnected`, `onClose`, `onAdd`, `onRun`,
  `onSetActive`, `onClear`, `onKeyDown`/`onKeyUp`, `onDialRotate`/`onDialDown`/`onDialUp`,
  `onDidReceiveSettings`, `onSendToPlugin`.

## Rendering a key

| Method | Use |
|---|---|
| `setBaseDataIcon(context, dataUri, text?)` | **primary** — push an SVG `data:` URI |
| `setStateIcon(context, i, text?)` | switch to a manifest-defined state image |
| `setPathIcon(context, path, text?)` | image from a file in the plugin |
| `setGifDataIcon` / `setGifPathIcon` | animated |

See [[Rendering Keys]].

## Commands

- `hotkey(keylist)` — send a keystroke to the focused window (see [[Hotkeys & Control]]).
- `toast(msg)`, `showAlert(context)`, `openUrl(url)`, `logMessage(msg, level)`.

## Settings & PI comms

- `getSettings/setSettings(context)`, `getGlobalSettings/setGlobalSettings`.
- `sendToPropertyInspector`, `sendToPlugin`, `sendParamFromPlugin`.

## context

Every button instance is identified by an opaque `context` string
(uuid + actionid + key). `decodeContext(context)` → `{ uuid, actionid, key }` tells
you *which action* a context belongs to — used to route events.

> [!tip] Don't hand-roll this
> [[Package - runtime]]'s `defineAction` gives you a `Button` object with
> `setIcon`, `hotkey`, `every`, `save`, and per-instance `state` — use that.
