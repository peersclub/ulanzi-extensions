// Shared hook-event logic — used by BOTH the per-event hook.mjs script (slow
// path / fallback) and the deck plugin's unix-socket daemon (fast path), so the
// two paths can never drift.
import { write, writeSession, sessionName } from "./broker-write.mjs";
import { parsePlanSteps } from "./broker-write.mjs";

// Advance the "current session" pointer only on user-facing moments.
const INTERACTION = new Set(["thinking", "awaiting_input"]);
// A pending permission ask is resolved once we move on.
const CLEARS_ASK = new Set(["thinking", "tool", "done", "idle"]);

/**
 * Apply one Claude Code hook event to the broker.
 * @param {string} status idle|thinking|tool|awaiting_input|done|permission
 * @param {any} j the hook's stdin payload
 */
export async function processHookEvent(status, j) {
  const sid = j?.session_id;

  // Plan ready (ExitPlanMode) — fires as PreToolUse ('tool') and PermissionRequest
  // ('permission'); both record the plan + a plan-type ask instead of clearing.
  if (j?.tool_name === "ExitPlanMode" && (status === "tool" || status === "permission")) {
    const raw = String(j?.tool_input?.plan || "");
    const steps = parsePlanSteps(raw);
    const patch = {
      status: "awaiting_input",
      ask: { type: "plan", tool: "ExitPlanMode", cmd: steps[0] || "", ts: Date.now() },
      plan: { steps, raw: raw.slice(0, 8000), ts: Date.now() },
    };
    if (j?.permission_mode) patch.mode = j.permission_mode;
    if (j?.cwd) patch.name = sessionName(j.cwd, sid);
    if (sid) await writeSession(sid, patch, { bumpActive: true });
    return;
  }

  // Permission prompt — record the ask so contextual keys light up.
  if (status === "permission") {
    const ti = j?.tool_input || {};
    const cmd = String(ti.command || ti.file_path || ti.path || ti.url || "").slice(0, 60);
    const patch = {
      status: "awaiting_input",
      ask: { type: "permission", tool: j?.tool_name, cmd, ts: Date.now() },
    };
    if (j?.permission_mode) patch.mode = j.permission_mode;
    if (j?.cwd) patch.name = sessionName(j.cwd, sid);
    if (sid) await writeSession(sid, patch, { bumpActive: true });
    return;
  }

  // Normal status stamping.
  const patch = { status };
  const tool = j?.tool_name || j?.tool?.name;
  if (status === "tool" && tool) patch.lastTool = tool;
  if (CLEARS_ASK.has(status)) { patch.ask = null; patch.plan = null; }
  if (status === "done") patch.finishedTs = Date.now();
  if (j?.permission_mode) patch.mode = j.permission_mode;
  if (j?.effort?.level) patch.effort = j.effort.level;
  if (j?.cwd) patch.name = sessionName(j.cwd, sid);

  if (sid) await writeSession(sid, patch, { bumpActive: INTERACTION.has(status) });
  else await write(patch);
}
