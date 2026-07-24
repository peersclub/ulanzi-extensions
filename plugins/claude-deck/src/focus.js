// @ts-check
/**
 * Focus follower: make the deck switch when you switch terminal tabs.
 *
 * Claude Code has no "terminal focused" hook, so the plugin polls the frontmost
 * window title via System Events (~800ms) and matches it against live sessions'
 * names / cwd basenames. On a match that differs from the current session it
 * bumps that session's activeTs — the normal watch cascade repaints the whole
 * deck within ~55ms. An explicit pin ALWAYS wins over focus-follow.
 *
 * First run may trigger a one-time macOS consent: "UlanziDeck wants to control
 * System Events" — must be allowed for focus-follow to work.
 */
import { execFile } from "node:child_process";
import { appendFileSync } from "node:fs";
import { basename, join } from "node:path";
import { userInfo, homedir } from "node:os";
import { listSessions, currentSession, getPin, clearPin, writeSession } from "@ulanzi-lab/broker";

// Focus candidates use a WIDE window (2h), not the 5-min "live" set: an idle
// terminal stops writing and would silently become unswitchable. tty matching
// is exact so staleness can't false-positive — and the switch bump itself
// revives the session's liveness.
const FOCUS_WINDOW_MS = 2 * 60 * 60 * 1000;
/** Keepalive cadence for the session whose tab you're sitting on. */
const KEEPALIVE_MS = 60_000;

const FDBG = !!process.env.ULANZI_DEBUG;
const flog = (...a) => {
  if (!FDBG) return;
  try { appendFileSync(join(homedir(), ".ulanzi-ai", "focus.log"), `${new Date().toISOString()} ${a.join(" ")}\n`); } catch {}
};

const OSA = `tell application "System Events"
  set p to first process whose frontmost is true
  set appName to name of p
  set winTitle to ""
  try
    set winTitle to name of front window of p
  end try
end tell
return appName & linefeed & winTitle`;

// App-specific tty probes, run ONLY when that app is frontmost. Kept separate
// because AppleScript compiles tell-blocks against the app's dictionary — a
// single script referencing a not-installed app fails to even parse.
const TTY_SCRIPTS = {
  Terminal: `tell application "Terminal" to tty of selected tab of front window`,
  iTerm2: `tell application "iTerm2" to tty of current session of current window`,
};

const getTty = (appName) =>
  new Promise((res) => {
    const script = TTY_SCRIPTS[appName];
    if (!script) return res("");
    execFile("osascript", ["-e", script], { timeout: 3000 }, (err, out) =>
      res(err ? "" : String(out).trim().replace(/^\/dev\//, ""))
    );
  });

/** Frontmost apps whose window title we trust to identify a terminal tab. */
const TERMINAL_APPS = new Set([
  "Terminal", "iTerm2", "iTerm", "Warp", "Ghostty", "kitty", "Alacritty",
  "WezTerm", "Hyper", "Tabby", "Code", "Cursor", "Windsurf",
]);

/**
 * Pick the session whose name/cwd best matches a window title.
 * Longest match wins; the OS username is a last resort (Terminal prefixes every
 * title with "user — ...", so it would otherwise match every tab).
 * @param {string} title
 * @param {Array<any>} sessions
 * @param {string} [selfName] the OS username to deprioritize
 */
export function matchSession(title, sessions, selfName = userInfo().username) {
  const t = (title || "").toLowerCase();
  if (!t) return null;
  let best = null;
  let bestLen = 0;
  for (const s of sessions) {
    const tokens = [s.name, s.cwd ? basename(s.cwd) : ""].filter(Boolean);
    for (const tok of tokens) {
      const lower = String(tok).toLowerCase();
      if (lower.length < 3 || !t.includes(lower)) continue;
      // Never match the OS username: Terminal prefixes every title with
      // "user — ...", so it would hijack the deck on ANY unrecognized tab.
      if (lower === String(selfName).toLowerCase()) continue;
      if (lower.length > bestLen) { best = s; bestLen = lower.length; }
    }
  }
  return best;
}

/**
 * Start polling. Returns a stop fn.
 * @param {string} app broker app id
 * @param {{intervalMs?: number, onSwitch?: (s:any)=>void}} [opts]
 */
export function startFocusFollower(app, opts = {}) {
  const interval = opts.intervalMs ?? 800;
  let lastTitle = "";
  let lastMatched = "";
  let lastKeepalive = 0;
  let busy = false;
  const tick = () => {
    if (busy) return;
    busy = true;
    execFile("osascript", ["-e", OSA], { timeout: 3000 }, async (err, stdout) => {
      busy = false;
      try {
        // The whole body is guarded: an exception here must NEVER kill the
        // plugin process (an unhandled rejection in this callback would).
        if (err) { flog("osascript ERROR (permission?):", String(err.message || err).slice(0, 120)); return; }
        const [appName, ...rest] = String(stdout).trim().split("\n");
        const title = rest.join(" ").trim();
        if (!TERMINAL_APPS.has(appName)) return;
        const now = Date.now();
        const candidates = listSessions(app).filter((s) => now - (s.ts || 0) < FOCUS_WINDOW_MS);
        // Exact match by tty first; when several sessions share a tty (restarts
        // in the same terminal), the most recent writer is the living one.
        const ftty = await getTty(appName);
        const byTty = ftty
          ? candidates.filter((s) => s.tty === ftty).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0]
          : null;
        const hit = byTty || matchSession(title, candidates);
        if (title !== lastTitle) {
          lastTitle = title;
          flog("tty:", ftty || "-", "title:", JSON.stringify(title.slice(0, 60)), "-> match:", hit ? `${hit.name}${byTty ? " (tty)" : " (title)"}` : "none");
        }
        if (!hit) return;
        const arrived = hit.sessionId !== lastMatched; // transitioned to a different session's tab
        lastMatched = hit.sessionId;
        const pin = getPin(app);
        if (pin) {
          // Pin semantics: "show that session until I return to it." Arriving at
          // the pinned session's own tab releases the pin; sitting on it or
          // working elsewhere leaves it in force.
          if (arrived && pin.sessionId === hit.sessionId) {
            await clearPin(app);
            flog("pin auto-released (returned to pinned session)");
          } else {
            return;
          }
        }
        if (currentSession(app)?.sessionId === hit.sessionId) {
          // Sitting on the current session's tab: keep it alive so the deck
          // never goes stale-dim under your eyes (max one write per minute).
          if (now - (hit.ts || 0) > KEEPALIVE_MS && now - lastKeepalive > KEEPALIVE_MS) {
            lastKeepalive = now;
            await writeSession(app, hit.sessionId, {}, { bumpActive: false });
            flog("keepalive ->", hit.name);
          }
          return;
        }
        // Re-assert on EVERY poll while focused: the switch bump also revives a
        // session that had gone quiet (its ts refreshes -> back in the live set).
        await writeSession(app, hit.sessionId, {}, { bumpActive: true });
        flog("SWITCHED ->", hit.name);
        opts.onSwitch?.(hit);
      } catch (e) {
        flog("tick err:", String(e && e.message || e));
      }
    });
  };
  const t = setInterval(tick, interval);
  tick();
  return () => clearInterval(t);
}
