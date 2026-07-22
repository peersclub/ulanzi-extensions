// Self-contained broker writer for the Claude Code adapter.
//
// Deliberately dependency-free (no @ulanzi-lab/broker import): these scripts are
// wired into Claude Code's global settings and run from ~/.claude, so they must
// keep working even if this repo moves. Mirrors the broker's contract
// (packages/broker/index.js), including the per-session layer.
import { promises as fs } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const APP = "claude-code";
const DIR = join(homedir(), ".ulanzi-ai");
const SESSIONS_DIR = join(DIR, "sessions");
const LEGACY_FILE = join(DIR, `${APP}.json`);

const sanitizeId = (id) => String(id || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");

async function atomicMerge(file, patch, extra = {}) {
  await fs.mkdir(file === LEGACY_FILE ? DIR : SESSIONS_DIR, { recursive: true });
  let cur = {};
  try { cur = JSON.parse(await fs.readFile(file, "utf8")); } catch {}
  const next = { ...cur, ...patch, app: APP, ts: Date.now(), ...extra(cur) };
  const tmp = file + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(next));
  await fs.rename(tmp, file);
  return next;
}

/** Legacy single-file write (kept for back-compat / manual priming). */
export async function write(patch) {
  return atomicMerge(LEGACY_FILE, patch, () => ({}));
}

/**
 * Write one session's state.
 * @param {string} sessionId
 * @param {object} patch
 * @param {{bumpActive?: boolean}} [opts] bumpActive advances `activeTs` (interaction).
 */
export async function writeSession(sessionId, patch, opts = {}) {
  const file = join(SESSIONS_DIR, `${APP}__${sanitizeId(sessionId)}.json`);
  const t = Date.now();
  return atomicMerge(file, patch, (cur) => ({
    sessionId,
    // Only a real interaction sets activeTs; never-interacted sessions stay at 0.
    activeTs: opts.bumpActive ? t : cur.activeTs ?? 0,
  }));
}

/** Read stdin JSON (statusline/hook payload). */
export async function readStdinJson() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

/**
 * A human label for a session: explicit env override, else the project folder
 * name, optionally with the git branch. Keeps the deck's "which terminal" clear.
 */
export function sessionName(cwd) {
  if (process.env.ULANZI_SESSION_NAME) return process.env.ULANZI_SESSION_NAME;
  const base = cwd ? basename(cwd) : "";
  const branch = gitBranch(cwd);
  if (base && branch && branch !== "main" && branch !== "master") return `${base}:${branch}`;
  return base || "claude";
}

function gitBranch(cwd) {
  try {
    const head = readFileSync(join(cwd, ".git", "HEAD"), "utf8").trim();
    const m = /ref:\s*refs\/heads\/(.+)$/.exec(head);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}
