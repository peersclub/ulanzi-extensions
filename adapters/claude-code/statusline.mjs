#!/usr/bin/env node
// Claude Code statusline command: Claude Code pipes rich session JSON on stdin
// and expects a status line on stdout. We do both — emit a compact line AND
// mirror the session into the broker so Claude Deck's info tiles update.
//
// Wire it in ~/.claude/settings.json:
//   "statusLine": { "type": "command", "command": "node /ABS/PATH/statusline.mjs" }
import { write, readStdinJson } from "./lib/broker-write.mjs";
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

// Context %: prefer an explicit field if a Claude Code version provides one;
// otherwise compute it from the transcript's token usage (the reliable path).
let contextPct;
const ctx = j?.context || j?.token_usage || {};
if (typeof ctx.used_pct === "number") contextPct = ctx.used_pct;
else if (typeof ctx.percent === "number") contextPct = ctx.percent;
else {
  const fromTranscript = await contextFromTranscript(j?.transcript_path);
  if (fromTranscript) contextPct = fromTranscript.pct;
}

const patch = { model, cwd, linesChanged };
if (sessionSecs != null) patch.sessionSecs = sessionSecs;
if (costSession != null) patch.costSession = costSession;
if (contextPct != null) patch.contextPct = contextPct;

try {
  await write(patch);
} catch {
  /* never let broker IO break the user's statusline */
}

// The visible status line (kept minimal; customize freely).
const short = cwd ? cwd.split("/").pop() : "";
const bits = [model && `◈ ${model}`, short && `⌂ ${short}`, linesChanged && `±${linesChanged}`].filter(Boolean);
process.stdout.write(bits.join("  "));
