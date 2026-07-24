#!/usr/bin/env node
// Claude Code hook -> broker (per session). Slow path / fallback: the deck
// plugin also hosts a unix-socket fast path (~5ms vs ~55ms node spawn) that
// runs the SAME logic via lib/hook-core.mjs. This script remains for:
//   - UserPromptSubmit (must be able to BLOCK the /session sentinel via exit 2)
//   - fallback when the deck plugin isn't running
//
//   node hook.mjs thinking|tool|awaiting_input|done|idle|permission
import { writeSession, readStdinJson, setNameOverride } from "./lib/broker-write.mjs";
import { processHookEvent } from "./lib/hook-core.mjs";

const status = process.argv[2] || "idle";
const j = await readStdinJson();
const sid = j?.session_id;

// `/session <name>` rename interceptor (UserPromptSubmit only; needs exit 2).
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
  process.stderr.write(`🎛  Ulanzi deck: session renamed to "${name}"`);
  process.exit(2);
}

try { await processHookEvent(status, j); } catch {}
process.exit(0);
