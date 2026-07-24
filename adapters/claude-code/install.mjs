#!/usr/bin/env node
// Wire the Claude Code adapter into ~/.claude/settings.json.
//
// SAFETY: dry-run by default (prints the merged result). Pass --apply to write,
// which first backs up settings.json. Hook groups are tagged with a marker so
// re-running is idempotent and won't duplicate entries.
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const node = process.execPath;
const statusline = resolve(HERE, "statusline.mjs");
const hook = resolve(HERE, "hook.mjs");
const MARK = "ulanzi-lab/claude-deck"; // marker to detect our own entries

// Fast path: pipe the event to the deck plugin's unix socket (~5ms). Falls back
// to the node script (~55ms spawn) when the plugin isn't running. Same logic
// both ways (lib/hook-core.mjs). UserPromptSubmit stays on the node path — it
// must be able to BLOCK the /session sentinel via exit code 2.
const SLOW_EVENTS = new Set(["UserPromptSubmit"]);
const cmd = (status, event) =>
  SLOW_EVENTS.has(event)
    ? `${node} ${hook} ${status}`
    : `j=$(cat); printf '%s\\n%s' '${status}' "$j" | nc -U -w 1 "$HOME/.ulanzi-ai/hook.sock" 2>/dev/null || printf '%s' "$j" | ${node} ${hook} ${status}`;

const SETTINGS = join(homedir(), ".claude", "settings.json");
const apply = process.argv.includes("--apply");

const EVENTS = {
  SessionStart: "idle",
  UserPromptSubmit: "thinking",
  PreToolUse: "tool",
  PostToolUse: "thinking",
  Notification: "awaiting_input",
  Stop: "done",
  PermissionRequest: "permission", // drives the contextual Allow/Always/Deny keys
};

function ourGroup(status, event) {
  return { _source: MARK, hooks: [{ type: "command", command: cmd(status, event) }] };
}

let settings = {};
try {
  settings = JSON.parse(await fs.readFile(SETTINGS, "utf8"));
} catch {
  console.log("(no existing settings.json — will create one)");
}

// statusLine: only set if unset, to avoid clobbering a custom one.
if (!settings.statusLine) {
  settings.statusLine = { type: "command", command: `${node} ${statusline}` };
} else if (!JSON.stringify(settings.statusLine).includes("statusline.mjs")) {
  console.log("⚠ You already have a statusLine. Leaving it. To feed the broker, add this to it:");
  console.log(`    ${node} ${statusline}   (it prints a line AND mirrors state)`);
}

// hooks: append our tagged group per event if not already present.
settings.hooks = settings.hooks || {};
for (const [event, status] of Object.entries(EVENTS)) {
  const arr = (settings.hooks[event] = settings.hooks[event] || []);
  // Find our existing group (tagged, or a hand-wired one running our hook) and
  // MIGRATE its command in place if it changed (e.g. slow path -> fast path);
  // otherwise append. Never duplicates.
  const mine = arr.find(
    (g) => g._source === MARK || (g.hooks || []).some((h) => (h.command || "").includes(`hook.mjs ${status}`))
  );
  const desired = cmd(status, event);
  if (mine) {
    mine._source = MARK;
    mine.hooks = [{ type: "command", command: desired }];
  } else {
    arr.push(ourGroup(status, event));
  }
}

const out = JSON.stringify(settings, null, 2);
if (!apply) {
  console.log("── DRY RUN (pass --apply to write) ──\n");
  console.log(out);
  process.exit(0);
}

await fs.mkdir(dirname(SETTINGS), { recursive: true });
try {
  const bak = `${SETTINGS}.bak.${Date.now()}`;
  await fs.copyFile(SETTINGS, bak);
  console.log(`backed up -> ${bak}`);
} catch {}
await fs.writeFile(SETTINGS, out);
console.log(`✓ wrote ${SETTINGS}`);
console.log("Restart/continue a Claude Code session; the deck will begin updating.");
