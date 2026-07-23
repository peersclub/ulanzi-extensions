#!/usr/bin/env node
// Claude Code statusline command: Claude Code pipes rich session JSON on stdin
// and expects a status line on stdout. We do both — emit a compact line AND
// mirror the session into the broker so Claude Deck's info tiles update.
//
// Wire it in ~/.claude/settings.json:
//   "statusLine": { "type": "command", "command": "node /ABS/PATH/statusline.mjs" }
import { write, writeSession, readStdinJson, sessionName } from "./lib/broker-write.mjs";
import { contextFromTranscript } from "./lib/context.mjs";

const j = await readStdinJson();

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
