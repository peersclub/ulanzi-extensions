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
import { promises as fs, readFileSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Root dir for all broker state files. Kept beside other Ulanzi config conventions. */
export const BROKER_DIR = join(homedir(), ".ulanzi-ai");

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
 * @property {string}  [cwd]           Working directory of the session.
 * @property {string}  [note]          Free-form short text for a tile.
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
