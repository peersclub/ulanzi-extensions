#!/usr/bin/env node
// Claude Code hook -> broker status stamper (per session).
//
// Maps each lifecycle event to a broker `status`, keyed by the event's
// session_id so concurrent terminals stay separate. Pass the status as argv:
//   node hook.mjs thinking        (UserPromptSubmit)
//   node hook.mjs tool            (PreToolUse)
//   node hook.mjs awaiting_input  (Notification)
//   node hook.mjs done            (Stop)
//   node hook.mjs idle            (SessionStart)
import { write, writeSession, readStdinJson, sessionName } from "./lib/broker-write.mjs";

const status = process.argv[2] || "idle";
const j = await readStdinJson();

// "current session" pointer: advance activeTs only on user-facing moments —
// a submitted prompt or a notification — so background tool churn in another
// terminal never steals the deck away from the one you're driving.
const INTERACTION = new Set(["thinking", "awaiting_input"]);

const patch = { status };
const tool = j?.tool_name || j?.tool?.name;
if (status === "tool" && tool) patch.lastTool = tool;
if (j?.cwd) patch.name = sessionName(j.cwd);

try {
  if (j?.session_id) await writeSession(j.session_id, patch, { bumpActive: INTERACTION.has(status) });
  else await write(patch);
} catch {}

process.exit(0);
