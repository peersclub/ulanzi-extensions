---
tags: [roadmap, vision, plan-mode]
---

# Dynamic & Engaging Deck

Vision for evolving the deck from static tiles + a few contextual keys into a
**living, phase-reactive control surface** that reshapes around what Claude is
doing. Grounded in confirmed signals (hooks carry `permission_mode`, `tool_name`,
`tool_input`; broker is event-driven ~55ms; hotkey injection works — see
[[Hotkeys & Control]] and [[Open Questions]]).

## Core idea: a phase engine

A session moves through phases; each has a different most-useful action + mood:

```
idle → thinking → using-tools → awaiting-permission → PLAN MODE → plan-ready → executing → done
```

A physical deck can't rearrange keys, so "dynamic layout" = a few **smart keys**
that morph meaning by phase (a single "Primary Action" key = Interrupt while
thinking, Approve while asked, Approve-Plan when a plan lands). Generalizes the
[[Claude Deck|contextual permission keys]] into a `phase` field on the broker.

| Phase | Primary key | Mood/theme |
|---|---|---|
| idle | new prompt / macros | calm, dim |
| thinking / tools | **Interrupt** (animated) + counters | blue, breathing |
| awaiting-permission | **Allow / Always / Deny** ✅ | amber, lit |
| **plan mode** | plan controls ↓ | **purple** |
| **plan-ready** | **Approve / Keep Planning** + dial-through-plan | purple, glowing |
| executing | Interrupt + progress | green, moving |
| done | cost/lines summary + what-next | green, celebratory |

> [!success] Plan mode — BUILT (2026-07-23)
> Detection + Approve/Keep-Planning keys + dial-through-plan shipped and verified.
> Confirmed on the real `ExitPlanMode` payload: `tool_input.plan` = plan markdown
> (fires as PreToolUse + PermissionRequest); `permission_mode` → `"auto"` after
> approval. Parser (`parsePlanSteps`) extracts step titles. On-device: place
> **Plan: Ready / Approve / Keep Planning / Dial Through**; keystroke calibration
> for approve/reject pending (defaults `y`/`n`).

## Showpiece: Plan mode

Signals are ideal:
- **Enter plan mode** → `permission_mode == "plan"` (already present in hook payloads)
  → deck re-themes purple, status "planning".
- **Plan ready** → `ExitPlanMode` is a tool, so `PreToolUse`/`PermissionRequest`
  carries **`tool_input.plan`** (the full plan markdown) + an approval prompt.

The plan-ready transform:
1. Hero tile "PLAN READY · N steps" (parse markdown into steps).
2. **Approve Plan** / **Keep Planning** contextual keys (same mechanism as Allow/Deny).
3. **Dial-through-plan** — rotate the encoder to step through the plan, one step
   per LCD ("Step 3/7: …") before approving. The tactile showpiece.

> [!note] Verify first
> Capture a real `ExitPlanMode` `PreToolUse` payload (same diagnostic approach as
> [[Multi-Session & Naming]]/PermissionRequest) to confirm `tool_input.plan`
> carries the text on this Claude Code version.

## Engagement toolkit

- **Animated tiles** — redraw the status tile ~5fps with a phase counter →
  breathing dot / rotating arc / animated "···". Pure SVG + a local timer (biggest
  "alive" win, low effort). `setGifDataIcon` available for prebaked animations.
- **Live climbing meters** — context gauge filling + green→amber→red; cost/token
  ticking; session timer.
- **Phase theming** — accent color per phase across the whole deck.
- **Celebration** — on `Stop`: flash + "✓ 214 lines · $0.42 · 3 tools".
- **Attention routing** — a key pulses red when any background session hits a
  permission/plan prompt; press to jump to it (radar over [[Multi-Session & Naming]]).

## Capability unlock: text injection

Single keystrokes are proven; next unlock is **clipboard paste** (plugin writes
`pbcopy`, sends ⌘V + Enter) → reliable full-text injection → **prompt macros**
("review this", "write tests"), a **slash-command palette**, a **model-switch dial**.
Turns the deck from monitor+approver into a launcher.

## Build order (impact / risk)

| Feature | Effort | Wow |
|---|---|---|
| Animated "thinking" tile | Low | High |
| Plan-ready detect + Approve/Refine | Low‑Med | High |
| Dial-through-plan | Med | Very high |
| Phase engine + theming | Med | High |
| Clipboard prompt macros | Low‑Med | High |
| Attention pulse | Low | Med |
| Done celebration | Low | Med |

Recommended: animated thinking → plan-mode pipeline (verify `ExitPlanMode` first)
→ phase engine → clipboard macros. Build a couple of concrete dynamic features
before the general engine, so the engine's shape is informed, not over-designed.

Related: [[Claude Deck]] · [[Plugin Catalog & Ideas]] · [[Hotkeys & Control]] · [[Roadmap & Phases]]
