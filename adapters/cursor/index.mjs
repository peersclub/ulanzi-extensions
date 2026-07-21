#!/usr/bin/env node
// Cursor -> broker adapter (STUB). See README.md.
//
// Run: node adapters/cursor/index.mjs   (writes ~/.ulanzi-ai/cursor.json)
// Today it only marks the app present. Fill in the TODOs to make it live, then
// point a deck's info tiles at "cursor" via the Property Inspector.
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FILE = join(homedir(), ".ulanzi-ai", "cursor.json");

async function write(patch) {
  await fs.mkdir(join(homedir(), ".ulanzi-ai"), { recursive: true });
  let cur = {};
  try { cur = JSON.parse(await fs.readFile(FILE, "utf8")); } catch {}
  const next = { ...cur, ...patch, app: "cursor", ts: Date.now() };
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(next));
  await fs.rename(tmp, FILE);
}

async function sample() {
  // TODO: derive real values (see README):
  //   model        <- Cursor settings / active model
  //   status       <- watch a Cursor log/state file for agent activity
  //   contextPct   <- conversation token usage if available
  //   linesChanged <- session diff stats
  //   cwd          <- workspace root
  await write({ status: "idle", note: "cursor adapter stub" });
}

await sample();
console.log("wrote", FILE, "(stub — see adapters/cursor/README.md)");
