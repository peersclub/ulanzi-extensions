// Self-contained broker writer for the Claude Code adapter.
//
// Deliberately dependency-free (no @ulanzi-lab/broker import): these scripts are
// wired into Claude Code's global settings and run from ~/.claude, so they must
// keep working even if this repo moves. It mirrors the broker's merge + atomic
// write contract (packages/broker/index.js).
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".ulanzi-ai");
const FILE = join(DIR, "claude-code.json");

export async function write(patch) {
  await fs.mkdir(DIR, { recursive: true });
  let cur = {};
  try {
    cur = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {}
  const next = { ...cur, ...patch, app: "claude-code", ts: Date.now() };
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(next));
  await fs.rename(tmp, FILE);
  return next;
}

export async function readStdinJson() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
