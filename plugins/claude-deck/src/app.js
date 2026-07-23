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
import { definePlugin, defineAction } from "@ulanzi-lab/runtime";
import { readState, currentSession, watchSessions } from "@ulanzi-lab/broker";
import { KpiTile, GaugeTile, StatusDot, ActionTile, NameTile, ModeTile, palette } from "@ulanzi-lab/tiles";

const APP = "claude-code";
const P = "com.ulanzi.ulanzideck.claudedeck";
// Heartbeat only refreshes time-based staleness; live switches come from the
// filesystem watch below (near-instant), not this tick.
const STALENESS_MS = 3000;

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

// Status subtitle shows WHICH session the light belongs to — key when several
// terminals are running, so a green "done" is unambiguous.
const Status = infoAction(`${P}.status`, (s) =>
  StatusDot({ status: (s.stale ? "idle" : s.status) || "idle", stale: s.stale, sub: s.name })
);

// Permission mode of the current session — why it does/doesn't prompt you.
const Mode = infoAction(`${P}.mode`, (s) => ModeTile({ mode: s.mode }));

// The session/terminal the deck is currently following, + how many are live.
const Name = infoAction(`${P}.name`, (s) =>
  NameTile({
    name: s.name || "—",
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
 */
function permAction(uuid, label, glyph, accent, defaultKeys) {
  return defineAction({
    uuid,
    active(b) {
      const app = b.settings.app || APP;
      const draw = () => {
        const s = currentSession(app) || {};
        const ask = s.ask && s.ask.type === "permission" && !s.stale ? s.ask : null;
        b.state.armed = !!ask;
        b.setIcon(
          ActionTile({ glyph, caption: label, accent, sub: ask ? ask.tool : "", dim: !ask })
        );
      };
      draw();
      b.addCleanup(watchSessions(app, draw));
      b.every(STALENESS_MS, draw, { leading: false });
    },
    run(b) {
      if (!b.state.armed) { b.toast(`No prompt to ${label.toLowerCase()}`); return; }
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
    Interrupt, Approve, Deny, Plan, Slash, Scroll,
  ],
}).start();
