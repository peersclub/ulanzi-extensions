// @ts-check
/**
 * Claude Deck — the flagship plugin.
 *
 * Two families of action, both tiny thanks to @ulanzi-lab/runtime + tiles:
 *   - INFO: poll the broker (~1s while active) and render a live tile.
 *   - CONTROL: on press, inject a hotkey. The exact `keylist` is a Property
 *     Inspector setting (defaults below) so the device's key syntax can be
 *     calibrated without touching code — see docs/CONVENTIONS.md #hotkey.
 *
 * Live state comes from adapters/claude-code writing the broker; usage/cost are
 * intentionally NOT here (the narlei plugins own those on adjacent keys).
 */
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { definePlugin, defineAction } from "@ulanzi-lab/runtime";
import { claudeBurstGif, gifDataUrl } from "@ulanzi-lab/tiles/gif.js";
import { writeDashboard, DASH_PATH } from "./dashboard.js";
import { startFocusFollower } from "./focus.js";
import { startHookDaemon } from "./hook-daemon.js";
import {
  readState, currentSession, watchSessions,
  liveSessions, listSessions, setPin, getPin, clearPin, writeSession,
} from "@ulanzi-lab/broker";

// Dashboard shows a broader window than the 5-min "live" filter, so idle-but-
// open terminals still appear (with their "last write" age making staleness clear).
const DASH_WINDOW_MS = 2 * 60 * 60 * 1000;
const dashboardSessions = (app) =>
  listSessions(app)
    .filter((s) => Date.now() - (s.ts || 0) < DASH_WINDOW_MS)
    .sort((a, b) => (b.activeTs || b.ts || 0) - (a.activeTs || a.ts || 0));
import { KpiTile, GaugeTile, StatusDot, ActionTile, NameTile, ModeTile, PlanHeroTile, PlanStepTile, SlotTile, SparkTile, BurstTile, brandize, palette } from "@ulanzi-lab/tiles";

const APP = "claude-code";
const P = "com.ulanzi.ulanzideck.claudedeck";
// Heartbeat only refreshes time-based staleness; live switches come from the
// filesystem watch below (near-instant), not this tick.
const STALENESS_MS = 3000;
// Animation frame rate for the "working" status spinner (~10fps, 30°/frame).
const ANIM_MS = 100;

/** 308000 -> "308k", 1000000 -> "1M", 950 -> "950". */
const fmtTok = (/** @type {number} */ n) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "k";
  return String(n);
};

/** 0.4237 -> "$0.42", 12.5 -> "$12.50", 123.4 -> "$123". */
const fmtCost = (/** @type {number} */ c) => {
  if (c == null) return "—";
  return c >= 100 ? "$" + Math.round(c) : "$" + c.toFixed(2);
};

const mmss = (/** @type {number} */ s) => {
  if (!s || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}h` : `${m}:${sec}`;
};

/**
 * Build an INFO action that re-renders from broker state on a timer.
 * The broker app id is configurable per key (Property Inspector "App" field),
 * defaulting to claude-code — this is what lets one deck target Cursor/Codex/etc.
 * once those adapters exist (see adapters/ and the Universal AI Deck idea).
 */
function infoAction(uuid, render) {
  return defineAction({
    uuid,
    active(b) {
      const app = b.settings.app || APP;
      // Follow the session you most recently interacted with; fall back to the
      // legacy single-file state (manual priming / no multi-session adapter).
      // Source badge: a small Claude burst marks tiles fed by Claude Code
      // (matters once other adapters — cursor/codex — share the deck).
      const draw = () => {
        const face = render(currentSession(app) || readState(app) || {});
        b.setIcon(app === APP ? brandize(face) : face);
      };
      draw(); // immediate
      // Near-instant switches: redraw the moment any session file changes.
      b.addCleanup(watchSessions(app, draw));
      // Heartbeat for staleness decay (no file event fires when a session goes quiet).
      b.every(STALENESS_MS, draw, { leading: false });
    },
  });
}

const Model = infoAction(`${P}.model`, (s) =>
  KpiTile({ title: "Model", value: s.model || "—", sub: s.contextPct != null ? `${Math.round(s.contextPct)}% ctx` : "" })
);

const Context = infoAction(`${P}.context`, (s) =>
  GaugeTile({ label: "Context", pct: s.contextPct ?? 0 })
);

// Status: animated spinner while working. Subtitle shows WHICH session the light
// belongs to. State is cached (refreshed on watch + heartbeat); the fast ANIM tick
// only re-renders the cached state with an advancing frame while thinking/tool —
// so the deck feels alive without hammering the filesystem.
const Status = defineAction({
  uuid: `${P}.status`,
  active(b) {
    const app = b.settings.app || APP;
    let frame = 0;
    let state = {};
    const st = () => (state.stale ? "idle" : state.status || "idle");
    const animating = () => st() === "thinking" || st() === "tool";
    const render = () =>
      b.setIcon(brandize(StatusDot({ status: st(), sub: state.name, stale: state.stale, frame: animating() ? frame : undefined })));
    const refresh = () => { state = currentSession(app) || readState(app) || {}; render(); };
    refresh();
    b.addCleanup(watchSessions(app, refresh));               // instant on state change
    b.every(STALENESS_MS, refresh, { leading: false });      // staleness decay
    b.every(ANIM_MS, () => { if (animating()) { frame++; render(); } }, { leading: false }); // spin
  },
});

// Permission mode of the current session — why it does/doesn't prompt you.
const Mode = infoAction(`${P}.mode`, (s) => ModeTile({ mode: s.mode }));

// Logged-in account (active disk login, refreshed every statusline render —
// stays correct across /switch-account). Shows the mailbox name big, org small.
const Account = infoAction(`${P}.account`, (s) => {
  const email = s.account || "";
  const user = email.split("@")[0] || "—";
  return KpiTile({
    title: "Account",
    value: user,
    sub: s.accountOrg || email.split("@")[1] || "",
    accent: palette.info,
  });
});

// The session/terminal the deck is currently following, + how many are live.
// Name tile flashes solid orange ("→ SWITCHED") for a beat whenever the deck
// changes sessions — focus-follow, a prompt elsewhere, or a pin — so switching
// is visible at a glance.
const Name = defineAction({
  uuid: `${P}.name`,
  active(b) {
    const app = b.settings.app || APP;
    let flashUntil = 0;
    const draw = () => {
      const s = currentSession(app) || readState(app) || {};
      if (s.sessionId && b.state.sid && s.sessionId !== b.state.sid) {
        flashUntil = Date.now() + 900;
        setTimeout(draw, 950); // schedule the un-flash
      }
      b.state.sid = s.sessionId;
      b.setIcon(brandize(NameTile({
        name: (s.pinned ? "📌" : "") + (s.name || "—"),
        sub: s.liveCount > 1 ? `${s.liveCount} live` : s.status || "",
        dim: s.stale,
        flash: Date.now() < flashUntil,
      })));
    };
    draw();
    b.addCleanup(watchSessions(app, draw));
    b.every(STALENESS_MS, draw, { leading: false });
  },
});

const Session = infoAction(`${P}.session`, (s) =>
  KpiTile({ title: "Session", value: mmss(s.sessionSecs ?? 0), sub: s.lastTool || "" })
);

const Lines = infoAction(`${P}.lines`, (s) => {
  const n = s.linesChanged ?? 0;
  return KpiTile({ title: "Lines", value: n > 0 ? `+${n}` : String(n), accent: palette.good });
});

// Session cost in USD — live burn for THIS session (account-level daily/weekly
// spend belongs to the aicost/claudeusage plugins on adjacent keys).
const Cost = infoAction(`${P}.cost`, (s) =>
  KpiTile({
    title: "Cost",
    value: fmtCost(s.costSession),
    sub: s.name || "",
    accent: s.costSession >= 10 ? palette.crit : s.costSession >= 3 ? palette.warn : palette.good,
  })
);

// Raw token counter: context-window tokens in use / window size.
const Tokens = infoAction(`${P}.tokens`, (s) =>
  KpiTile({
    title: "Tokens",
    value: fmtTok(s.tokensUsed),
    sub: s.tokensWindow ? `of ${fmtTok(s.tokensWindow)}` : "",
  })
);

// Cost burn sparkline from the same rolling history (cost series).
const CostTrend = infoAction(`${P}.costtrend`, (s) => {
  const pts = (s.hist || []).map((h) => h.cost).filter((v) => typeof v === "number");
  return SparkTile({
    label: "Burn",
    values: pts.length ? pts : [0, 0],
    value: fmtCost(s.costSession),
    accent: (s.costSession ?? 0) >= 10 ? palette.crit : (s.costSession ?? 0) >= 3 ? palette.warn : palette.good,
  });
});

// Context trend sparkline from the session's rolling history.
const Trend = infoAction(`${P}.trend`, (s) => {
  const pts = (s.hist || []).map((h) => h.pct).filter((v) => typeof v === "number");
  return SparkTile({
    label: "Ctx Trend",
    values: pts.length ? pts : [0, 0],
    value: s.contextPct != null ? `${Math.round(s.contextPct)}%` : "—",
    accent: (s.contextPct ?? 0) >= 90 ? palette.crit : (s.contextPct ?? 0) >= 70 ? palette.warn : palette.accent,
  });
});

// (The static hotkey control keys — Interrupt/Approve/Deny/Plan-toggle/Slash and
// the Transcript Scroll dial — were removed: they depended on keystroke tokens
// never verified on-device (escape/shift+tab/arrows) or a broken send method.
// The contextual Allow/Deny (proven y/n), Macro (clipboard ⌘V) and Effort Dial
// (settings.json write) cover their use cases with verified mechanisms.)

/**
 * Contextual permission key: dim/no-op until the current session shows a
 * permission prompt (broker `ask.type === "permission"`), then it lights up and
 * its press sends the configured key(s). Keys are space-separated for multi-step
 * selections (e.g. "down enter" to pick "always allow"). Follows the session
 * being asked (PermissionRequest bumps activeTs), so it tracks the right terminal.
 * @param {string} uuid @param {string} label @param {string} glyph
 * @param {string} accent @param {string} defaultKeys
 * @param {'permission'|'plan'} [askType] which ask arms this key (default permission)
 */
function permAction(uuid, label, glyph, accent, defaultKeys, askType = "permission") {
  return defineAction({
    uuid,
    active(b) {
      const app = b.settings.app || APP;
      const draw = () => {
        const s = currentSession(app) || {};
        const ask = s.ask && s.ask.type === askType && !s.stale ? s.ask : null;
        b.state.armed = !!ask;
        const sub = ask ? (askType === "plan" ? `${(s.plan?.steps || []).length} steps` : ask.tool) : "";
        b.setIcon(ActionTile({ glyph, caption: label, accent, sub, dim: !ask }));
      };
      draw();
      b.addCleanup(watchSessions(app, draw));
      b.every(STALENESS_MS, draw, { leading: false });
    },
    run(b) {
      if (!b.state.armed) { b.toast(`No ${askType} to ${label.toLowerCase()}`); return; }
      const keys = (b.settings.keylist || defaultKeys).trim().split(/\s+/);
      keys.forEach((k, i) => { if (k) setTimeout(() => b.hotkey(k), i * 80); });
    },
  });
}

// Defaults use plain letters (y/n) — the permission prompt accepts them and they
// avoid the undocumented special-key tokens, so they're the best first hotkey test.
const Allow = permAction(`${P}.allow`, "Allow", "✓", palette.good, "y");
const Reject = permAction(`${P}.reject`, "Deny", "✕", palette.crit, "n");

// --- Plan mode: contextual keys armed when a plan is presented (ask.type "plan") ---
const PlanApprove = permAction(`${P}.planapprove`, "Approve", "✓", palette.good, "y", "plan");
const PlanReject = permAction(`${P}.planreject`, "Keep Planning", "↻", palette.warn, "n", "plan");

// Plan hero: "PLAN READY · N steps" for the current session (dim when none).
const PlanHero = infoAction(`${P}.planhero`, (s) =>
  PlanHeroTile({ steps: s.plan && !s.stale ? s.plan.steps : [], dim: s.stale })
);

// (Plan dial-through and fleet selection both live in SmartDial now — one knob
// that morphs by context instead of two mostly-idle dedicated dials.)

// --- Fleet view (Codex-Micro-style): one key per live session -----------------

/** Unread = the session finished after you last viewed/interacted with it. */
const isUnread = (s) => (s.finishedTs || 0) > Math.max(s.viewedTs || 0, s.activeTs || 0);

/**
 * Session Slot key: shows the Nth live session as a full-color status light
 * (blue working, amber needs-you, green unread, red error, dim idle/empty).
 * Press → pin the deck to it (+ mark viewed). Press again → unpin.
 * Slot number comes from Property Inspector settings (default 1).
 */
const Slot = defineAction({
  uuid: `${P}.slot`,
  active(b) {
    const app = b.settings.app || APP;
    let frame = 0;
    const draw = () => {
      const n = Math.max(1, parseInt(b.settings.slot, 10) || 1);
      const s = liveSessions(app)[n - 1];
      b.state.sid = s?.sessionId;
      if (!s) { b.state.pulse = false; b.setIcon(SlotTile({ slot: n, empty: true })); return; }
      const pinned = getPin(app)?.sessionId === s.sessionId;
      const current = currentSession(app)?.sessionId === s.sessionId;
      // Attention pulse: this session needs you and you're NOT already on it.
      b.state.pulse = s.status === "awaiting_input" && !current;
      b.setIcon(SlotTile({
        slot: n, name: s.name, status: s.status, unread: isUnread(s), pinned,
        flash: b.state.pulse && frame % 2 === 1,
      }));
    };
    b.state.draw = draw;
    draw();
    b.addCleanup(watchSessions(app, draw));
    b.every(STALENESS_MS, draw, { leading: false });
    b.every(500, () => { if (b.state.pulse) { frame++; draw(); } }, { leading: false });
  },
  async run(b) {
    const app = b.settings.app || APP;
    const sid = b.state.sid;
    if (!sid) { b.toast("Empty slot"); return; }
    if (getPin(app)?.sessionId === sid) {
      await clearPin(app);
      b.toast("Unpinned — following your input again");
    } else {
      await setPin(app, sid);
      b.toast("Deck pinned to this session");
    }
    // Mark viewed (clears green "unread"); this write also wakes every watcher,
    // so all tiles — including other slots' pin markers — redraw immediately.
    await writeSession(app, sid, { viewedTs: Date.now() });
    b.state.draw?.();
  },
});

/**
 * Smart Dial: the knob's function morphs with context, so it's never dead.
 *   plan pending  -> rotate through the plan's steps; PRESS = approve the plan
 *   otherwise     -> rotate through live sessions;    PRESS = pin/unpin
 */
const SmartDial = defineAction({
  uuid: `${P}.smartdial`,
  active(b) {
    const app = b.settings.app || APP;
    b.state.i = 0;
    const draw = () => {
      const cur = currentSession(app);
      const planMode = !!(cur && !cur.stale && cur.ask?.type === "plan" && cur.plan?.steps?.length);
      if (planMode !== b.state.planMode) { b.state.planMode = planMode; b.state.i = 0; }
      const wrap = (n) => (b.state.i = ((b.state.i % n) + n) % n); // knobs wrap, never stick at ends
      if (planMode) {
        const steps = cur.plan.steps;
        wrap(steps.length);
        b.setIcon(PlanStepTile({ index: b.state.i, total: steps.length, text: steps[b.state.i] }));
        return;
      }
      const live = liveSessions(app);
      if (!live.length) { b.setIcon(SlotTile({ empty: true })); b.state.sid = null; return; }
      wrap(live.length);
      const s = live[b.state.i];
      b.state.sid = s.sessionId;
      b.setIcon(SlotTile({ slot: b.state.i + 1, name: s.name, status: s.status, unread: isUnread(s), pinned: getPin(app)?.sessionId === s.sessionId }));
    };
    b.state.draw = draw;
    draw();
    b.addCleanup(watchSessions(app, draw));
    b.every(STALENESS_MS, draw, { leading: false });
  },
  dial(b, ticks) {
    b.state.i = (b.state.i || 0) + (ticks < 0 ? -1 : 1);
    b.state.draw?.();
  },
  async dialDown(b) {
    const app = b.settings.app || APP;
    if (b.state.planMode) {
      b.hotkey(b.settings.keylist || "y"); // approve the reviewed plan
      b.toast("Plan approved");
      return;
    }
    const sid = b.state.sid;
    if (!sid) return;
    if (getPin(app)?.sessionId === sid) await clearPin(app);
    else { await setPin(app, sid); await writeSession(app, sid, { viewedTs: Date.now() }); }
    b.state.draw?.();
  },
});

/**
 * Command Dial: a command palette on one knob — rotate through the list
 * (PI `command` = comma-separated), press to send the shown command.
 */
const CmdDial = defineAction({
  uuid: `${P}.cmddial`,
  active(b) {
    b.state.i = 0;
    const list = () =>
      (b.settings.command || "/compact,/clear,/context,/cost,/resume,/model,/AIUse,/switch-account")
        .split(",").map((s) => s.trim()).filter(Boolean);
    b.state.list = list;
    const draw = () => {
      const cmds = list();
      b.state.i = ((b.state.i % cmds.length) + cmds.length) % cmds.length;
      b.setIcon(ActionTile({
        glyph: "/",
        caption: cmds[b.state.i].replace(/^\//, "").slice(0, 12),
        accent: palette.plan,
        sub: `${b.state.i + 1}/${cmds.length} · press sends`,
      }));
    };
    b.state.draw = draw;
    draw();
  },
  settings(b) { b.state.draw?.(); },
  dial(b, ticks) {
    b.state.i += ticks < 0 ? -1 : 1;
    b.state.draw?.();
  },
  dialDown(b) {
    const cmds = b.state.list();
    sendCommand(b, cmds[((b.state.i % cmds.length) + cmds.length) % cmds.length]);
  },
});

/**
 * Macro keys: inject a command into the focused terminal via clipboard paste —
 * pbcopy, then ⌘V (documented Mac modifier format), then enter. Keystrokes and
 * the command are PI-overridable per key. `macroAction` powers both the generic
 * Macro key and the preset command row (/compact, /clear, /cost, ...).
 * @param {string} uuid @param {string} defaultCmd @param {string} [glyph]
 */
/** Send a command to the focused terminal: pbcopy -> ⌘V -> enter (PI-overridable). */
function sendCommand(b, cmd, keylistDefault = "⌘V enter") {
  const p = execFile("pbcopy");
  p.stdin.end(cmd);
  p.on("close", () => {
    const keys = (b.settings.keylist || keylistDefault).trim().split(/\s+/);
    keys.forEach((k, i) => setTimeout(() => b.hotkey(k), 120 + i * 120));
  });
  b.toast(`Sent ${cmd}`);
}

function macroAction(uuid, defaultCmd, glyph = "⌘") {
  const face = (b) => {
    const cmd = b.settings.command || defaultCmd;
    b.setIcon(ActionTile({ glyph, caption: cmd.replace(/^\//, "").slice(0, 12), accent: palette.plan, sub: "sends" }));
  };
  return defineAction({
    uuid,
    active: face,
    settings: face,
    run(b) {
      sendCommand(b, b.settings.command || defaultCmd);
    },
  });
}

const Macro = macroAction(`${P}.macro`, "/compact");
// Preset command row — built-ins + this machine's custom commands.
const CmdCompact = macroAction(`${P}.cmdcompact`, "/compact", "🗜");
const CmdClear = macroAction(`${P}.cmdclear`, "/clear", "🧹");
const CmdContext = macroAction(`${P}.cmdcontext`, "/context", "◔");
const CmdCost = macroAction(`${P}.cmdcost`, "/cost", "$");
const CmdResume = macroAction(`${P}.cmdresume`, "/resume", "↻");
const CmdModel = macroAction(`${P}.cmdmodel`, "/model", "◈");
const CmdUsage = macroAction(`${P}.cmdusage`, "/AIUse", "Σ");
const CmdSwitch = macroAction(`${P}.cmdswitch`, "/switch-account", "👤");

// --- Dashboard, Beacon, Effort dial -------------------------------------------

/**
 * Dashboard key: keeps ~/.ulanzi-ai/dashboard.html fresh (rewritten on every
 * broker change while the key is visible; the page self-reloads every 2s), and
 * opens it in a popup webview on press.
 */
const Dashboard = defineAction({
  uuid: `${P}.dashboard`,
  active(b) {
    const app = b.settings.app || APP;
    const regen = () => writeDashboard(dashboardSessions(app), currentSession(app));
    b.setIcon(ActionTile({ glyph: "▦", caption: "Dashboard", accent: palette.info }));
    regen();
    b.addCleanup(watchSessions(app, regen));
    b.every(STALENESS_MS, regen, { leading: false });
  },
  run(b) {
    b.$UD.openView(DASH_PATH, 1040, 720);
  },
});

/**
 * Beacon key: a natively-animated GIF face (no per-frame traffic).
 *   amber pulse  = some session needs your input
 *   blue spinner = the current session is working
 *   green pulse  = a finished session is unread
 *   dim          = all quiet
 * GIFs are generated once at startup; we only re-send when the state changes.
 */
/**
 * Claude Logo key: the mark, alive — a gently breathing orange Claude burst,
 * always animated. Pure identity: "this deck is Claude." No press action.
 */
const CLAUDE_LIVE = gifDataUrl(claudeBurstGif(palette.accent, { mode: "pulse" }));
const ClaudeLogo = defineAction({
  uuid: `${P}.claudelogo`,
  active(b) {
    b.$UD.setGifDataIcon(b.context, CLAUDE_LIVE);
  },
});

// All beacon states are the Claude starburst, colored by state:
// amber pulsing = needs you, blue spinning = working, green pulsing = unread.
const GIF_FACES = {
  attention: gifDataUrl(claudeBurstGif(palette.warn, { mode: "pulse" })),
  working: gifDataUrl(claudeBurstGif(palette.info, { mode: "spin" })),
  unread: gifDataUrl(claudeBurstGif(palette.good, { mode: "pulse" })),
};
const Beacon = defineAction({
  uuid: `${P}.beacon`,
  active(b) {
    const app = b.settings.app || APP;
    const draw = () => {
      const live = liveSessions(app);
      const cur = currentSession(app);
      let face = "quiet";
      if (live.some((s) => s.status === "awaiting_input")) face = "attention";
      else if (cur && !cur.stale && (cur.status === "thinking" || cur.status === "tool")) face = "working";
      else if (live.some((s) => isUnread(s))) face = "unread";
      if (face === b.state.face) return; // GIFs are big — only send on change
      b.state.face = face;
      if (face === "quiet") b.setIcon(BurstTile({ caption: "Fleet", dim: true }));
      else b.$UD.setGifDataIcon(b.context, GIF_FACES[face]);
    };
    draw();
    b.addCleanup(watchSessions(app, draw));
    b.every(STALENESS_MS, draw, { leading: false });
  },
});

/**
 * Effort dial: rotate to choose a reasoning level, press to apply. Applies by
 * writing `effortLevel` to ~/.claude/settings.json — Claude Code live-reloads
 * it (verified), so no keystroke injection and no terminal focus needed.
 * "auto" removes the key (back to model default).
 */
const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "auto"];
const EffortDial = defineAction({
  uuid: `${P}.effortdial`,
  active(b) {
    const app = b.settings.app || APP;
    b.state.i = 2; // start at "high"
    const draw = () => {
      const s = currentSession(app) || {};
      const sel = EFFORT_LEVELS[b.state.i];
      b.setIcon(KpiTile({
        title: "Effort",
        value: sel.toUpperCase(),
        sub: s.effort ? `now: ${s.effort}` : "press to apply",
        accent: palette.plan,
      }));
    };
    b.state.draw = draw;
    draw();
    b.addCleanup(watchSessions(app, draw));
  },
  dial(b, ticks) {
    b.state.i = (b.state.i + (ticks < 0 ? -1 : 1) + EFFORT_LEVELS.length) % EFFORT_LEVELS.length;
    b.state.draw?.();
  },
  dialDown(b) {
    const sel = EFFORT_LEVELS[b.state.i];
    const file = join(homedir(), ".claude", "settings.json");
    try {
      const s = JSON.parse(readFileSync(file, "utf8"));
      if (sel === "auto") delete s.effortLevel;
      else s.effortLevel = sel;
      writeFileSync(file, JSON.stringify(s, null, 2));
      b.toast(`Effort → ${sel} (next turn)`);
    } catch {
      b.toast("Could not update settings.json");
    }
  },
});

// Follow the terminal tab you focus (pin still wins). One-time macOS consent
// ("UlanziDeck wants to control System Events") may appear on first run.
startFocusFollower(APP);

// Hook fast path: hooks pipe events here (~5ms) instead of spawning node (~55ms).
startHookDaemon();

definePlugin({
  uuid: P,
  actions: [
    Model, Context, Status, Name, Mode, Account, Session, Lines, Cost, Tokens, Trend, CostTrend,
    Dashboard, Beacon, EffortDial, ClaudeLogo,
    Allow, Reject,
    PlanApprove, PlanReject, PlanHero,
    Slot, SmartDial, CmdDial, Macro,
    CmdCompact, CmdClear, CmdContext, CmdCost, CmdResume, CmdModel, CmdUsage, CmdSwitch,
  ],
}).start();
