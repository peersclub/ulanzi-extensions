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
import { liveSessions, currentSession, getPin, writeSession } from "@ulanzi-lab/broker";

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
set t to ""
try
  if appName is "Terminal" then
    tell application "Terminal" to set t to tty of selected tab of front window
  else if appName is "iTerm2" then
    tell application "iTerm2" to set t to tty of current session of current window
  end if
end try
return appName & linefeed & t & linefeed & winTitle`;

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
  let busy = false;
  const tick = () => {
    if (busy) return;
    busy = true;
    execFile("osascript", ["-e", OSA], { timeout: 3000 }, async (err, stdout) => {
      busy = false;
      if (err) { flog("osascript ERROR (permission?):", String(err.message || err).slice(0, 120)); return; }
      const [appName, ttyLine, ...rest] = String(stdout).trim().split("\n");
      const title = rest.join(" ").trim();
      if (!TERMINAL_APPS.has(appName)) { flog("frontmost not a terminal:", appName); return; }
      const live = liveSessions(app);
      // Exact match by tty first (Claude renames tab titles to topic slugs, so
      // titles are unreliable); title heuristics only as fallback.
      const ftty = (ttyLine || "").trim().replace(/^\/dev\//, "");
      const byTty = ftty && live.find((s) => s.tty === ftty);
      const hit = byTty || matchSession(title, live);
      if (title !== lastTitle) {
        lastTitle = title;
        flog("tty:", ftty || "-", "title:", JSON.stringify(title.slice(0, 60)), "-> match:", hit ? `${hit.name}${byTty ? " (tty)" : " (title)"}` : "none");
      }
      if (!hit) return;
      lastMatched = hit.sessionId;
      if (getPin(app)) return; // explicit pin always wins
      // Re-assert on EVERY poll while focused (not just on change): background
      // sessions bump their own activeTs as they work, so a one-shot bump lets
      // them steal "current" back from the terminal you're actually looking at.
      if (currentSession(app)?.sessionId === hit.sessionId) return;
      try {
        await writeSession(app, hit.sessionId, {}, { bumpActive: true });
        flog("SWITCHED ->", hit.name);
        opts.onSwitch?.(hit);
      } catch (e) { flog("write err:", String(e)); }
    });
  };
  const t = setInterval(tick, interval);
  tick();
  return () => clearInterval(t);
}
