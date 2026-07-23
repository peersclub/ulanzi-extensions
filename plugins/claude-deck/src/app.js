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
import { definePlugin, defineAction } from "@ulanzi-lab/runtime";
import {
  readState, currentSession, watchSessions,
  liveSessions, setPin, getPin, clearPin, writeSession,
} from "@ulanzi-lab/broker";
import { KpiTile, GaugeTile, StatusDot, ActionTile, NameTile, ModeTile, PlanHeroTile, PlanStepTile, SlotTile, palette } from "@ulanzi-lab/tiles";

const APP = "claude-code";
const P = "com.ulanzi.ulanzideck.claudedeck";
// Heartbeat only refreshes time-based staleness; live switches come from the
// filesystem watch below (near-instant), not this tick.
const STALENESS_MS = 3000;
// Animation frame rate for the "working" status spinner (~6fps).
const ANIM_MS = 160;

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
      const draw = () => b.setIcon(render(currentSession(app) || readState(app) || {}));
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
      b.setIcon(StatusDot({ status: st(), sub: state.name, stale: state.stale, frame: animating() ? frame : undefined }));
    const refresh = () => { state = currentSession(app) || readState(app) || {}; render(); };
    refresh();
    b.addCleanup(watchSessions(app, refresh));               // instant on state change
    b.every(STALENESS_MS, refresh, { leading: false });      // staleness decay
    b.every(ANIM_MS, () => { if (animating()) { frame++; render(); } }, { leading: false }); // spin
  },
});

// Permission mode of the current session — why it does/doesn't prompt you.
const Mode = infoAction(`${P}.mode`, (s) => ModeTile({ mode: s.mode }));

// The session/terminal the deck is currently following, + how many are live.
const Name = infoAction(`${P}.name`, (s) =>
  NameTile({
    name: (s.pinned ? "📌" : "") + (s.name || "—"),
    sub: s.liveCount > 1 ? `${s.liveCount} live` : s.status || "",
    dim: s.stale,
  })
);

const Session = infoAction(`${P}.session`, (s) =>
  KpiTile({ title: "Session", value: mmss(s.sessionSecs ?? 0), sub: s.lastTool || "" })
);

const Lines = infoAction(`${P}.lines`, (s) => {
  const n = s.linesChanged ?? 0;
  return KpiTile({ title: "Lines", value: n > 0 ? `+${n}` : String(n), accent: palette.good });
});

/**
 * Build a CONTROL action: static face while active, hotkey on press.
 * @param {string} uuid @param {string} glyph @param {string} caption @param {string} defaultKey
 */
function controlAction(uuid, glyph, caption, defaultKey) {
  return defineAction({
    uuid,
    active(b) {
      b.state.face = ActionTile({ glyph, caption, accent: palette.info });
      b.setIcon(b.state.face);
    },
    run(b) {
      const key = b.settings.keylist || defaultKey;
      // `command` is provided by the slash-command inspector; if present, prefer it.
      const key2 = b.settings.command || key;
      if (key2) b.hotkey(key2);
      b.toast(`${caption}`);
    },
  });
}

const Interrupt = controlAction(`${P}.interrupt`, "⎋", "Interrupt", "escape");
const Approve = controlAction(`${P}.approve`, "✓", "Approve", "y");
const Deny = controlAction(`${P}.deny`, "✕", "Deny", "n");
const Plan = controlAction(`${P}.plan`, "⇧", "Plan", "shift+tab");
const Slash = controlAction(`${P}.slash`, "/", "Command", "");

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
const AlwaysAllow = permAction(`${P}.alwaysallow`, "Always", "✓✓", palette.info, "down enter");
const Reject = permAction(`${P}.reject`, "Deny", "✕", palette.crit, "n");

// --- Plan mode: contextual keys armed when a plan is presented (ask.type "plan") ---
const PlanApprove = permAction(`${P}.planapprove`, "Approve", "✓", palette.good, "y", "plan");
const PlanReject = permAction(`${P}.planreject`, "Keep Planning", "↻", palette.warn, "n", "plan");

// Plan hero: "PLAN READY · N steps" for the current session (dim when none).
const PlanHero = infoAction(`${P}.planhero`, (s) =>
  PlanHeroTile({ steps: s.plan && !s.stale ? s.plan.steps : [], dim: s.stale })
);

// Encoder: dial through the plan's steps; press to jump back to the first.
const PlanScroll = defineAction({
  uuid: `${P}.planscroll`,
  active(b) {
    const app = b.settings.app || APP;
    b.state.i = 0;
    const draw = () => {
      const s = currentSession(app) || {};
      const steps = s.plan && !s.stale ? s.plan.steps : [];
      if (!steps.length) { b.setIcon(PlanHeroTile({ steps: [], dim: true })); return; }
      b.state.i = Math.max(0, Math.min(b.state.i, steps.length - 1));
      b.setIcon(PlanStepTile({ index: b.state.i, total: steps.length, text: steps[b.state.i] }));
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
  dialDown(b) {
    b.state.i = 0;
    b.state.draw?.();
  },
});

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
    const draw = () => {
      const n = Math.max(1, parseInt(b.settings.slot, 10) || 1);
      const s = liveSessions(app)[n - 1];
      b.state.sid = s?.sessionId;
      if (!s) { b.setIcon(SlotTile({ slot: n, empty: true })); return; }
      const pinned = getPin(app)?.sessionId === s.sessionId;
      b.setIcon(SlotTile({ slot: n, name: s.name, status: s.status, unread: isUnread(s), pinned }));
    };
    b.state.draw = draw;
    draw();
    b.addCleanup(watchSessions(app, draw));
    b.every(STALENESS_MS, draw, { leading: false });
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

/** Fleet Dial: rotate to preview each live session; press to pin/unpin it. */
const FleetDial = defineAction({
  uuid: `${P}.fleetdial`,
  active(b) {
    const app = b.settings.app || APP;
    b.state.i = 0;
    const draw = () => {
      const live = liveSessions(app);
      if (!live.length) { b.setIcon(SlotTile({ empty: true })); b.state.sid = null; return; }
      b.state.i = Math.max(0, Math.min(b.state.i, live.length - 1));
      const s = live[b.state.i];
      b.state.sid = s.sessionId;
      const pinned = getPin(app)?.sessionId === s.sessionId;
      b.setIcon(SlotTile({ slot: b.state.i + 1, name: s.name, status: s.status, unread: isUnread(s), pinned }));
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
    const sid = b.state.sid;
    if (!sid) return;
    if (getPin(app)?.sessionId === sid) await clearPin(app);
    else { await setPin(app, sid); await writeSession(app, sid, { viewedTs: Date.now() }); }
    b.state.draw?.();
  },
});

/**
 * Macro key: inject a full command into the focused terminal via clipboard
 * paste — pbcopy, then ⌘V (documented Mac modifier format), then enter. All
 * keystrokes PI-overridable (`keylist`, space-separated) for calibration.
 */
const Macro = defineAction({
  uuid: `${P}.macro`,
  active(b) {
    const cmd = b.settings.command || "/compact";
    b.setIcon(ActionTile({ glyph: "⌘", caption: cmd.slice(0, 12), accent: palette.plan }));
  },
  settings(b) {
    const cmd = b.settings.command || "/compact";
    b.setIcon(ActionTile({ glyph: "⌘", caption: cmd.slice(0, 12), accent: palette.plan }));
  },
  run(b) {
    const cmd = b.settings.command || "/compact";
    const p = execFile("pbcopy");
    p.stdin.end(cmd);
    p.on("close", () => {
      const keys = (b.settings.keylist || "⌘V enter").trim().split(/\s+/);
      keys.forEach((k, i) => setTimeout(() => b.hotkey(k), 120 + i * 120));
    });
    b.toast(`Sent ${cmd}`);
  },
});

/** Encoder: rotate to scroll the transcript, press to jump to bottom. */
const Scroll = defineAction({
  uuid: `${P}.scroll`,
  active(b) {
    b.setIcon(ActionTile({ glyph: "↕", caption: "Scroll", accent: palette.warn }));
  },
  dial(b, ticks) {
    const up = b.settings.keylistUp || "up";
    const down = b.settings.keylistDown || "down";
    const key = ticks < 0 ? up : down;
    for (let i = 0; i < Math.min(Math.abs(ticks) || 1, 5); i++) b.hotkey(key);
  },
  dialDown(b) {
    b.hotkey(b.settings.keylistBottom || "shift+g");
  },
});

definePlugin({
  uuid: P,
  actions: [
    Model, Context, Status, Name, Mode, Session, Lines,
    Allow, AlwaysAllow, Reject,
    PlanApprove, PlanReject, PlanHero, PlanScroll,
    Slot, FleetDial, Macro,
    Interrupt, Approve, Deny, Plan, Slash, Scroll,
  ],
}).start();
