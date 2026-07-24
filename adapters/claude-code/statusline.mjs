#!/usr/bin/env node
// Claude Code statusline command: Claude Code pipes rich session JSON on stdin
// and expects a status line on stdout. We do both — emit a compact line AND
// mirror the session into the broker so Claude Deck's info tiles update.
//
// Wire it in ~/.claude/settings.json:
//   "statusLine": { "type": "command", "command": "node /ABS/PATH/statusline.mjs" }
import { execSync } from "node:child_process";
import { write, writeSession, readStdinJson, sessionName } from "./lib/broker-write.mjs";
import { contextFromTranscript } from "./lib/context.mjs";

const j = await readStdinJson();

// Record which terminal (tty) this session lives on, so the deck can match the
// FOCUSED tab exactly (Claude renames tab titles to topic slugs, so title
// matching is unreliable). Claude spawns us detached (tty "??"), but the claude
// TUI itself owns the tty — walk up the parent chain until we find it.
let tty = "";
try {
  let p = process.pid;
  for (let i = 0; i < 6 && p > 1; i++) {
    const t = execSync(`ps -o tty= -p ${p}`).toString().trim();
    if (t && t !== "??") { tty = t; break; }
    p = parseInt(execSync(`ps -o ppid= -p ${p}`).toString().trim(), 10) || 0;
  }
} catch {}

const model = j?.model?.display_name || j?.model?.id || "";
const cwd = j?.workspace?.current_dir || j?.cwd || "";
const cost = j?.cost || {};
const added = cost.total_lines_added ?? 0;
const removed = cost.total_lines_removed ?? 0;
const linesChanged = added + removed;
const sessionSecs = cost.total_duration_ms ? Math.round(cost.total_duration_ms / 1000) : undefined;
const costSession = typeof cost.total_cost_usd === "number" ? cost.total_cost_usd : undefined;

// Context %: prefer the official statusline field (`context_window.used_percentage`),
// fall back to older field names, then compute from the transcript token usage.
// The transcript read also yields the RAW token counts for the Tokens tile.
let contextPct;
let tokensUsed;
let tokensWindow;
const cw = j?.context_window || {};
const ctx = j?.context || j?.token_usage || {};
const fromTranscript = await contextFromTranscript(j?.transcript_path);
if (fromTranscript) {
  tokensUsed = fromTranscript.usedTokens;
  tokensWindow = fromTranscript.windowTokens;
}
if (typeof cw.used_percentage === "number") contextPct = Math.round(cw.used_percentage);
else if (typeof ctx.used_pct === "number") contextPct = ctx.used_pct;
else if (typeof ctx.percent === "number") contextPct = ctx.percent;
else if (fromTranscript) contextPct = fromTranscript.pct;

const patch = { model, cwd, linesChanged, name: sessionName(cwd, j?.session_id) };
if (tty && tty !== "??") patch.tty = tty; // e.g. "ttys009"

// Logged-in account (same source as the user's statusline badge): read fresh
// every render so it stays correct across /switch-account. Note: this is the
// active DISK login — hooks don't expose which account an already-running
// session authenticated with.
try {
  const { readFileSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const acct = JSON.parse(readFileSync(homedir() + "/.claude.json", "utf8"))?.oauthAccount;
  if (acct?.emailAddress) {
    patch.account = acct.emailAddress;
    if (acct.organizationName) patch.accountOrg = acct.organizationName;
  }
} catch {}
if (j?.permission_mode) patch.mode = j.permission_mode;
if (sessionSecs != null) patch.sessionSecs = sessionSecs;
if (costSession != null) patch.costSession = costSession;
if (contextPct != null) patch.contextPct = contextPct;
if (tokensUsed != null) { patch.tokensUsed = tokensUsed; patch.tokensWindow = tokensWindow; }

try {
  // Statusline fires on render, not on interaction → never bump activeTs here.
  // histSample: rolling per-session history (context% / cost) for trend tiles.
  if (j?.session_id) {
    await writeSession(j.session_id, patch, {
      bumpActive: false,
      histSample: contextPct != null || costSession != null
        ? { t: Date.now(), pct: contextPct ?? null, cost: costSession ?? null }
        : undefined,
    });
  } else await write(patch); // no session id: fall back to the legacy single file
} catch {
  /* never let broker IO break the user's statusline */
}

// The visible status line (kept minimal; customize freely).
const short = cwd ? cwd.split("/").pop() : "";
const bits = [model && `◈ ${model}`, short && `⌂ ${short}`, linesChanged && `±${linesChanged}`].filter(Boolean);
process.stdout.write(bits.join("  "));
