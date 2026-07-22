// @ts-check
/**
 * Ergonomic runtime over the raw UlanziApi.
 *
 * The installed reference plugins (stock, claude-usage) all reimplement the same
 * plumbing by hand: a Map of per-`context` instances, jittered polling started
 * on `setactive` and torn down on clear, and a big switch to route events to the
 * right action. This package captures that once so a plugin author only writes
 * declarative {@link defineAction} handlers.
 *
 * Usage:
 *   const Foo = defineAction({ uuid, active(b){ b.every(1000, ()=> b.setIcon(...)) } });
 *   definePlugin({ uuid: "com.ulanzi.ulanzideck.foo", actions: [Foo] }).start();
 */
import UlanziApi from "@ulanzi-lab/sdk";
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Lightweight always-on file logger for on-device debugging. UlanziDeck captures
// plugin stdout only in a binary .xlog, so we tee key lifecycle events to a plain
// text file we can read. Cheap and safe.
// Off by default; enable with ULANZI_DEBUG=1 (or a truthy value) when diagnosing
// on-device issues. Kept because the deck's only other logs are binary .xlog.
const DBG_ON = !!process.env.ULANZI_DEBUG;
const DBG_FILE = join(homedir(), ".ulanzi-ai", "claude-deck.log");
function dbg(...a) {
  if (!DBG_ON) return;
  try {
    mkdirSync(join(homedir(), ".ulanzi-ai"), { recursive: true });
    appendFileSync(DBG_FILE, `[${new Date().toISOString()}] ${a.join(" ")}\n`);
  } catch {}
}

/**
 * A live button instance (one per placed key = one `context`). Handlers get this
 * as their sole argument; per-instance scratch lives on `.state`.
 */
export class Button {
  /** @param {UlanziApi} ud @param {string} context @param {string} uuid */
  constructor(ud, context, uuid) {
    this.$UD = ud;
    this.context = context;
    this.uuid = uuid;
    /** @type {Record<string, any>} arbitrary per-instance scratch */
    this.state = {};
    /** @type {Record<string, any>} settings from the Property Inspector */
    this.settings = {};
    this.active = false;
    /** @type {Set<NodeJS.Timeout>} */
    this._timers = new Set();
  }

  /** Push an SVG `data:` URI (or a state index) to the key face. */
  setIcon(/** @type {string} */ dataUri, /** @type {string} */ text) {
    if (!this._loggedIcon) {
      this._loggedIcon = true;
      dbg("setIcon ctx=", this.context, "len=", dataUri?.length, "head=", String(dataUri).slice(0, 40));
    }
    this.$UD.setBaseDataIcon(this.context, dataUri, text);
  }
  setStateIcon(/** @type {number} */ i, /** @type {string} */ text) {
    this.$UD.setStateIcon(this.context, i, text);
  }
  /** Inject a hotkey/combo into the focused window. */
  hotkey(/** @type {string} */ key) {
    this.$UD.hotkey(key);
  }
  toast(/** @type {string} */ msg) {
    this.$UD.toast(msg);
  }
  /** Persist settings for this button. */
  save(/** @type {Record<string, any>} */ patch) {
    this.settings = { ...this.settings, ...patch };
    this.$UD.setSettings(this.settings, this.context);
  }

  /**
   * Run `fn` now and every `ms` — but only while the button is active. Timers are
   * torn down automatically on inactive/clear, so handlers never leak intervals.
   * A small random offset avoids thundering-herd polls when many buttons exist.
   * @param {number} ms @param {() => void} fn @param {{jitter?: number, leading?: boolean}} [opts]
   */
  every(ms, fn, opts = {}) {
    const run = () => {
      try { fn(); } catch (e) { this.$UD.logMessage?.(`poll error: ${e?.message}`, "error"); }
    };
    if (opts.leading !== false) run();
    const start = () => {
      const t = setInterval(run, ms);
      this._timers.add(t);
    };
    const jitter = opts.jitter ?? Math.min(ms, 3000) * pseudoRandom(this.context);
    const s = setTimeout(start, jitter);
    this._timers.add(s);
    return () => { clearTimeout(s); };
  }

  _clearTimers() {
    for (const t of this._timers) { clearInterval(t); clearTimeout(t); }
    this._timers.clear();
  }
}

/** Deterministic 0..1 from a string — stable jitter without Math.random churn. */
function pseudoRandom(/** @type {string} */ s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return (h % 1000) / 1000;
}

/**
 * @typedef {Object} ActionDef
 * @property {string} uuid Full action UUID (5+ dot-segments).
 * @property {(b: Button) => void} [active]    Button became visible/active.
 * @property {(b: Button) => void} [inactive]  Button hidden/deactivated.
 * @property {(b: Button) => void} [run]       Key pressed (Keypad).
 * @property {(b: Button, ticks: number) => void} [dial] Encoder rotated.
 * @property {(b: Button) => void} [dialDown]  Encoder pressed.
 * @property {(b: Button, settings: Record<string, any>) => void} [settings] PI settings arrived/changed.
 */

/** Declare an action. Just returns the def; {@link definePlugin} wires it. */
export function defineAction(/** @type {ActionDef} */ def) {
  if (!def.uuid) throw new Error("defineAction: uuid is required");
  return def;
}

/**
 * Build and run a plugin from a set of actions.
 * @param {{uuid: string, actions: ActionDef[], onReady?: () => void}} cfg
 */
export function definePlugin(cfg) {
  const $UD = new UlanziApi();
  /** @type {Map<string, ActionDef>} */
  const byUuid = new Map(cfg.actions.map((a) => [a.uuid, a]));
  /** @type {Map<string, Button>} context -> Button */
  const buttons = new Map();

  const log = (...a) => console.log(`[${cfg.uuid}]`, ...a);

  function defFor(/** @type {string} */ context) {
    const uuid = ($UD.decodeContext(context) || {}).uuid || "";
    return { uuid, def: byUuid.get(uuid) };
  }

  function ensure(/** @type {string} */ context) {
    let b = buttons.get(context);
    if (!b) {
      const { uuid } = defFor(context);
      b = new Button($UD, context, uuid);
      buttons.set(context, b);
    }
    return b;
  }

  function dispose(/** @type {string} */ context) {
    const b = buttons.get(context);
    if (!b) return;
    b._clearTimers();
    buttons.delete(context);
  }

  return {
    $UD,
    buttons,
    start() {
      // Resilience: the SDK emits 'error' on WS failure; with no listener Node
      // throws and the whole plugin crashes. Studio can spawn us before its
      // bridge is ready, so we must survive a failed connect and retry.
      let reconnectT = null;
      const scheduleReconnect = () => {
        if (reconnectT) return;
        reconnectT = setTimeout(() => {
          reconnectT = null;
          dbg("reconnecting");
          try { $UD.connect(cfg.uuid); } catch (e) { dbg("reconnect failed", e?.message); scheduleReconnect(); }
        }, 1500);
      };
      $UD.onError((e) => { dbg("ws error", String(e)); scheduleReconnect(); });

      $UD.connect(cfg.uuid);
      dbg("connect", cfg.uuid, "actions:", [...byUuid.keys()].join(","));
      $UD.onConnected(() => { log("connected"); dbg("connected"); cfg.onReady?.(); });

      $UD.onAdd((d) => {
        const { uuid, def } = defFor(d.context);
        dbg("onAdd ctx=", d.context, "decodedUuid=", uuid, "matched=", !!def);
        const b = ensure(d.context);
        if (d.param) { b.settings = d.param; def?.settings?.(b, d.param); }
      });

      $UD.onDidReceiveSettings((d) => {
        const b = ensure(d.context);
        if (d.param) { b.settings = d.param; defFor(d.context).def?.settings?.(b, d.param); }
      });

      $UD.onSetActive((d) => {
        const b = ensure(d.context);
        const { uuid, def } = defFor(d.context);
        dbg("onSetActive ctx=", d.context, "decodedUuid=", uuid, "active=", d.active, "matched=", !!def);
        if (d.active) {
          b.active = true;
          def?.active?.(b);
        } else {
          b.active = false;
          b._clearTimers();
          def?.inactive?.(b);
        }
      });

      $UD.onRun((d) => defFor(d.context).def?.run?.(ensure(d.context)));
      $UD.onKeyDown?.((d) => defFor(d.context).def?.run?.(ensure(d.context)));
      $UD.onDialRotate?.((d) => defFor(d.context).def?.dial?.(ensure(d.context), d.ticks ?? 0));
      $UD.onDialDown?.((d) => defFor(d.context).def?.dialDown?.(ensure(d.context)));

      $UD.onClear((d) => {
        const params = /** @type {any} */ (d).param;
        if (Array.isArray(params)) params.forEach((p) => dispose(p.context));
      });

      $UD.onClose(() => { for (const c of [...buttons.keys()]) dispose(c); scheduleReconnect(); });

      const bye = () => { for (const c of [...buttons.keys()]) dispose(c); process.exit(0); };
      process.on("SIGINT", bye);
      process.on("SIGTERM", bye);
      return this;
    },
  };
}
