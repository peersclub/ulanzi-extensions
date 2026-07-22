#!/usr/bin/env node
// TEMPORARY diagnostic: capture the full stdin payload of whatever hook event
// invokes it, so we can see (on THIS machine's Claude Code version) exactly what
// fires around a permission prompt and what fields are available.
//
// Usage in settings.json: node diag-hook.mjs <EventLabel>
// Appends one JSON line per invocation to ~/.ulanzi-ai/hook-diag.log.
// Never blocks anything (always exits 0) and never decides permissions.
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const label = process.argv[2] || "?";
let raw = "";
try {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  raw = Buffer.concat(chunks).toString("utf8").trim();
} catch {}

let parsed = null;
try { parsed = JSON.parse(raw); } catch {}

const dir = join(homedir(), ".ulanzi-ai");
try {
  mkdirSync(dir, { recursive: true });
  appendFileSync(
    join(dir, "hook-diag.log"),
    JSON.stringify({ at: new Date().toISOString(), label, event: parsed?.hook_event_name, keys: parsed ? Object.keys(parsed) : [], tool: parsed?.tool_name, message: parsed?.message, payload: parsed }) + "\n"
  );
} catch {}

process.exit(0);
