// @ts-check
/**
 * The broker: a single normalized JSON file that decouples "which AI tool is
 * running" from "what the deck shows".
 *
 *   AI-app adapters  --write-->  ~/.ulanzi-ai/<app>.json  --read-->  deck plugin
 *
 * Any AI coding tool (Claude Code, Cursor, Codex, ...) gets a thin adapter that
 * fills the SAME {@link AiState} shape. The deck never learns tool-specific
 * details — add a tool by writing one adapter, with zero plugin changes.
 */
import { promises as fs, readFileSync, readdirSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Root dir for all broker state files. Kept beside other Ulanzi config conventions. */
export const BROKER_DIR = join(homedir(), ".ulanzi-ai");

/** Per-session state files live here: `<app>__<sessionId>.json`. */
export const SESSIONS_DIR = join(BROKER_DIR, "sessions");

/** @typedef {'idle'|'thinking'|'tool'|'awaiting_input'|'done'|'error'} SessionStatus */

/**
 * The normalized session state. Every field is optional so partial adapters
 * (e.g. a statusline that knows model but not tokens) still produce valid state.
 * @typedef {Object} AiState
 * @property {string}  [app]           Source tool id, e.g. "claude-code".
 * @property {string}  [model]         Short model label, e.g. "sonnet".
 * @property {SessionStatus} [status]  Live activity of the session.
 * @property {number}  [contextPct]    Context window used, 0-100.
 * @property {number}  [costSession]   USD spent this session.
 * @property {number}  [sessionSecs]   Session duration in seconds.
 * @property {number}  [linesChanged]  Net lines added+removed this session.
 * @property {string}  [lastTool]      Most recent tool invoked, e.g. "Edit".
 * @property {'default'|'acceptEdits'|'plan'|'bypassPermissions'|string} [mode]
 *                                     Permission mode of the session (why it does/doesn't prompt).
 * @property {string}  [cwd]           Working directory of the session.
 * @property {string}  [note]          Free-form short text for a tile.
 * @property {{type:'permission', tool?:string, cmd?:string, ts?:number}|null} [ask]
 *                                     What Claude is currently asking (drives contextual keys).
 * @property {string}  [name]          Human label for the session (project/terminal).
 * @property {string}  [sessionId]     Owning session id (multi-session files).
 * @property {number}  [activeTs]      Unix ms of last user interaction (current-session pick).
 * @property {number}  [ts]            Unix ms timestamp of last write (staleness).
 */

/** How old (ms) state may be before the deck should treat it as stale/idle. */
export const STALE_MS = 30_000;

function fileFor(/** @type {string} */ app) {
  return join(BROKER_DIR, `${app}.json`);
}

/**
 * Merge-write state for an app. Adapters can call this with only the fields they
 * know; existing fields are preserved. Always stamps `ts`.
 * @param {string} app
 * @param {Partial<AiState>} patch
 * @param {() => number} [now] injectable clock (tests)
 */
export async function writeState(app, patch, now = Date.now) {
  await fs.mkdir(BROKER_DIR, { recursive: true });
  let current = {};
  try {
    current = JSON.parse(await fs.readFile(fileFor(app), "utf8"));
  } catch {
    /* first write */
  }
  const next = { ...current, ...patch, app, ts: now() };
  // Write-then-rename so a reader never sees a half-written file.
  const tmp = fileFor(app) + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(next));
  await fs.rename(tmp, fileFor(app));
  return next;
}

/**
 * Read the latest state for an app (sync — cheap enough for a poll loop).
 * Returns null if missing/unreadable, and marks `stale` if past STALE_MS.
 * @param {string} app
 * @returns {(AiState & { stale?: boolean }) | null}
 */
export function readState(app, now = Date.now) {
  try {
    /** @type {AiState} */
    const s = JSON.parse(readFileSync(fileFor(app), "utf8"));
    const stale = typeof s.ts === "number" && now() - s.ts > STALE_MS;
    return { ...s, stale };
  } catch {
    return null;
  }
}

/**
 * Watch an app's state file and call `onChange` with fresh state on every write.
 * Debounced so the rename-dance doesn't fire twice. Returns an unwatch fn.
 * @param {string} app
 * @param {(s: AiState & { stale?: boolean }) => void} onChange
 */
export function watchState(app, onChange) {
  let timer = null;
  let watcher = null;
  const fire = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const s = readState(app);
      if (s) onChange(s);
    }, 40);
  };
  const arm = () => {
    try {
      watcher = watch(fileFor(app), fire);
      watcher.on("error", rearm);
    } catch {
      rearm();
    }
  };
  // The file may not exist yet; retry until the adapter creates it.
  let rearmTimer = null;
  function rearm() {
    if (watcher) { try { watcher.close(); } catch {} watcher = null; }
    clearTimeout(rearmTimer);
    rearmTimer = setTimeout(arm, 1000);
  }
  arm();
  fire(); // emit initial state if present
  return () => {
    clearTimeout(timer);
    clearTimeout(rearmTimer);
    if (watcher) { try { watcher.close(); } catch {} }
  };
}

// ---------------------------------------------------------------------------
// Multi-session support
//
// Each concurrent session (terminal) of an app writes its own file so they
// never clobber each other. The deck picks the "current" session — the one you
// most recently interacted with — via `activeTs`, which adapters bump only on
// user-facing events (a prompt, a notification), not on background tool churn.
// ---------------------------------------------------------------------------

/** How long since last interaction before a session stops being "live". */
export const SESSION_LIVE_MS = 5 * 60 * 1000;
/** Prune session files untouched for this long. */
const SESSION_PRUNE_MS = 24 * 60 * 60 * 1000;

const sanitizeId = (id) => String(id || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");

function sessionFile(app, id) {
  return join(SESSIONS_DIR, `${app}__${sanitizeId(id)}.json`);
}

/**
 * Merge-write one session's state.
 * @param {string} app
 * @param {string} sessionId
 * @param {Partial<import('./index.js').AiState> & {name?:string}} patch
 * @param {{bumpActive?: boolean, now?: () => number}} [opts]
 */
export async function writeSession(app, sessionId, patch, opts = {}) {
  const now = opts.now || Date.now;
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  const f = sessionFile(app, sessionId);
  let cur = {};
  try { cur = JSON.parse(await fs.readFile(f, "utf8")); } catch {}
  const t = now();
  const next = { ...cur, ...patch, app, sessionId, ts: t };
  // activeTs = "last interaction". ONLY a real interaction sets it; a session
  // that has never been interacted with stays at 0 so background writes can
  // never rank it above a session you actually prompted.
  next.activeTs = opts.bumpActive ? t : cur.activeTs ?? 0;
  const tmp = f + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(next));
  await fs.rename(tmp, f);
  pruneSessions(now).catch(() => {});
  return next;
}

/** Best-effort removal of session files untouched for SESSION_PRUNE_MS. */
async function pruneSessions(now = Date.now) {
  let files = [];
  try { files = readdirSync(SESSIONS_DIR); } catch { return; }
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const s = JSON.parse(readFileSync(join(SESSIONS_DIR, f), "utf8"));
      if (now() - (s.ts || 0) > SESSION_PRUNE_MS) await fs.rm(join(SESSIONS_DIR, f), { force: true });
    } catch {}
  }
}

/**
 * All sessions for an app, most-recently-interacted first.
 * @returns {Array<import('./index.js').AiState & {sessionId:string, name?:string, activeTs?:number}>}
 */
export function listSessions(app) {
  let files = [];
  try {
    files = readdirSync(SESSIONS_DIR).filter((f) => f.startsWith(`${app}__`) && f.endsWith(".json"));
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    try { out.push(JSON.parse(readFileSync(join(SESSIONS_DIR, f), "utf8"))); } catch {}
  }
  // Rank by interaction first (a real prompt always beats none), then by last
  // write as a tiebreaker. NOT `activeTs || ts` — that lets a 0 activeTs fall
  // back to write time and outrank a genuinely-interacted session.
  out.sort((a, b) => (b.activeTs || 0) - (a.activeTs || 0) || (b.ts || 0) - (a.ts || 0));
  return out;
}

/**
 * Watch the sessions directory and call `onChange` whenever any session file
 * changes — so the deck can switch near-instantly instead of polling. Debounced
 * (the atomic tmp+rename write fires multiple raw events). Re-arms if the dir
 * doesn't exist yet. Returns an unwatch fn.
 * @param {string} _app reserved (dir holds all apps); kept for call symmetry
 * @param {() => void} onChange
 */
export function watchSessions(_app, onChange) {
  let watcher = null;
  let debounce = null;
  let rearm = null;
  const fire = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { try { onChange(); } catch {} }, 50);
  };
  const arm = () => {
    try {
      watcher = watch(SESSIONS_DIR, fire);
      watcher.on("error", reArm);
    } catch {
      reArm();
    }
  };
  function reArm() {
    if (watcher) { try { watcher.close(); } catch {} watcher = null; }
    clearTimeout(rearm);
    rearm = setTimeout(arm, 1000);
  }
  arm();
  return () => {
    clearTimeout(debounce);
    clearTimeout(rearm);
    if (watcher) { try { watcher.close(); } catch {} }
  };
}

/**
 * The session the deck should display: the most-recently-interacted one.
 * Adds `stale`, `sessionCount`, and `liveCount` for tile rendering.
 * @param {string} app
 * @param {{now?: () => number}} [opts]
 */
export function currentSession(app, opts = {}) {
  const now = opts.now || Date.now;
  const all = listSessions(app);
  if (!all.length) return null;
  const top = all[0];
  return {
    ...top,
    stale: typeof top.ts === "number" && now() - top.ts > STALE_MS,
    sessionCount: all.length,
    liveCount: all.filter((s) => now() - (s.ts || 0) < SESSION_LIVE_MS).length,
  };
}
