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

// --- permission prompt (PermissionRequest hook) ---
// Record what Claude is asking so the deck can light up contextual Allow/Always/
// Deny keys and switch to this session. MUST NOT emit a decision (exit 0, no
// stdout) so the normal TUI prompt still shows.
if (status === "permission") {
  const tool = j?.tool_name;
  const ti = j?.tool_input || {};
  const cmd = String(ti.command || ti.file_path || ti.path || ti.url || "").slice(0, 60);
  const ask = { type: "permission", tool, cmd, ts: Date.now() };
  const patch = { status: "awaiting_input", ask };
  if (j?.cwd) patch.name = sessionName(j.cwd, sid);
  try { if (sid) await writeSession(sid, patch, { bumpActive: true }); } catch {}
  process.exit(0);
}

// --- normal status stamping ---
// Advance the "current session" pointer only on user-facing moments.
const INTERACTION = new Set(["thinking", "awaiting_input"]);
// A pending permission ask is resolved once we move on (prompt submitted, a tool
// starts running = it was allowed, turn ends, or a new session starts).
const CLEARS_ASK = new Set(["thinking", "tool", "done", "idle"]);

const patch = { status };
const tool = j?.tool_name || j?.tool?.name;
if (status === "tool" && tool) patch.lastTool = tool;
if (CLEARS_ASK.has(status)) patch.ask = null;
if (j?.cwd) patch.name = sessionName(j.cwd, sid);

try {
  if (sid) await writeSession(sid, patch, { bumpActive: INTERACTION.has(status) });
  else await write(patch);
} catch {}

process.exit(0);
