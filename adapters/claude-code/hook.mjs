#!/usr/bin/env node
// Claude Code hook -> broker status stamper.
//
// Claude Code runs a hook command per lifecycle event and pipes event JSON on
// stdin. We map each event to a broker `status` (and capture the tool name on
// PreToolUse). Pass the status as argv, e.g.:
//   node hook.mjs thinking        (UserPromptSubmit)
//   node hook.mjs tool            (PreToolUse)
//   node hook.mjs awaiting_input  (Notification)
//   node hook.mjs done            (Stop)
//   node hook.mjs idle            (SessionStart)
import { write, readStdinJson } from "./lib/broker-write.mjs";

const status = process.argv[2] || "idle";
const j = await readStdinJson();

const patch = { status };
// On PreToolUse the event carries the tool being called — surface it on tiles.
const tool = j?.tool_name || j?.tool?.name;
if (status === "tool" && tool) patch.lastTool = tool;

try {
  await write(patch);
} catch {}

// Hooks must exit 0 and not block; emit nothing on stdout.
process.exit(0);
