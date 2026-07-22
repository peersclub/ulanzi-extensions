#!/usr/bin/env node
// Claude Code hook -> broker status stamper (per session), plus the `/session`
// rename interceptor.
//
// Status mapping (pass status as argv):
//   node hook.mjs thinking        (UserPromptSubmit)
//   node hook.mjs tool            (PreToolUse)
//   node hook.mjs awaiting_input  (Notification)
//   node hook.mjs done            (Stop)
//   node hook.mjs idle            (SessionStart)
//
// `/session <name>` (defined in ~/.claude/commands/session.md) expands to a
// sentinel prompt. On UserPromptSubmit we detect it, persist the name override
// for THIS session_id (only the hook has it), switch the deck to it, and BLOCK
// the prompt so the model never sees the sentinel.
import { write, writeSession, readStdinJson, sessionName, setNameOverride } from "./lib/broker-write.mjs";

const status = process.argv[2] || "idle";
const j = await readStdinJson();
const sid = j?.session_id;

// --- /session rename interceptor (UserPromptSubmit only carries a prompt) ---
const SENTINEL = /^\s*\[\[ulanzi-session\]\]\s+(.+?)\s*$/;
const m = typeof j?.prompt === "string" ? j.prompt.match(SENTINEL) : null;
if (m) {
  const name = m[1].trim();
  try {
    if (sid) {
      await setNameOverride(sid, name);
      await writeSession(sid, { name, status: "idle" }, { bumpActive: true });
    }
  } catch {}
  // Block the sentinel from reaching the model; show a confirmation instead.
  process.stderr.write(`🎛  Ulanzi deck: session renamed to "${name}"`);
  process.exit(2);
}

// --- normal status stamping ---
// Advance the "current session" pointer only on user-facing moments.
const INTERACTION = new Set(["thinking", "awaiting_input"]);

const patch = { status };
const tool = j?.tool_name || j?.tool?.name;
if (status === "tool" && tool) patch.lastTool = tool;
if (j?.cwd) patch.name = sessionName(j.cwd, sid);

try {
  if (sid) await writeSession(sid, patch, { bumpActive: INTERACTION.has(status) });
  else await write(patch);
} catch {}

process.exit(0);
