---
tags: [adapter, feature, focus]
---

# Focus Follow

The deck tracks **whichever terminal tab you're working in** — switch tabs and
every tile flips to that session within ~1s, with the Name tile flashing solid
orange **→ SWITCHED** so the change is unmistakable.

## How it works (v2 — exact tty matching)

1. Each session records its **tty** (`ttys005`…) in the broker — the statusline
   walks up its parent-process chain to the claude TUI, which owns the terminal
   device (helpers are spawned detached, `tty: ??`).
2. The plugin polls the frontmost window (~800ms, System Events) and asks
   Terminal/iTerm2 for the focused tab's tty via app-specific AppleScript
   (separate scripts — AppleScript can't even parse a `tell` block for an
   app that isn't installed).
3. **tty-to-tty match** → bump that session's `activeTs` → the watch cascade
   repaints the deck in ~30ms.

Title matching remains only as a fallback for other terminal apps — v1 used
titles and failed because **Claude Code renames tabs to topic slugs** (no
project name present), and the OS-username prefix (`Victor — …`) would have
matched every tab.

## Priority order

**📌 pin** (slot press) → **focus** (frontmost tab) → **last prompt** (activeTs).
Focus re-asserts on *every* poll, not one-shot — a busy background session
bumping its own activeTs can't steal the deck back while you're typing.

## The idle-notification bug (fixed)

Claude fires periodic `idle_prompt` Notifications for sessions just sitting
there. Treating every Notification as an interaction let **idle sessions steal
"current"** (deck showed portfolio's 40% while the user's real session was at
62%). Now only `notification_type == "permission_prompt"` is an interaction;
idle reminders are liveness heartbeats only — which also stops idle sessions
showing false amber "needs you" on [[Fleet Deck]] slots.

## Reliability hardening (v1.0.1)

"Worked twice then stopped" root cause: focus candidates came from the 5-minute
**live** set, so terminals idle >5min silently became unswitchable. Fixes:

- **2-hour candidate window** — tty matching is exact, so no false positives;
  the switch bump itself revives a quiet session.
- **Keepalive** — the session whose tab you're sitting on gets a liveness write
  (max 1/min), so the deck never goes stale-dim under your eyes.
- **Newest-writer wins** when several sessions share a tty (restarts in the
  same terminal).
- The whole poll tick is exception-guarded (an unhandled rejection would have
  killed the plugin).

## Pin auto-release

Pin semantics: **"show that session until I return to it."** Arriving at the
pinned session's own tab releases the pin and tab-following resumes; sitting on
it or working elsewhere keeps it in force. This dissolved the accidental-pin
trap (a stray slot/knob press silently froze tab-following — twice).

## Permissions (one-time macOS consents)

UlanziDeck → **System Events** (frontmost window) and → **Terminal** (tty probe).
Without them the follower silently does nothing; everything else still works.

Related: [[Multi-Session & Naming]] · [[Fleet Deck]] · [[Claude Deck]]
