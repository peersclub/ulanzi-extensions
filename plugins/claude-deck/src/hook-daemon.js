// @ts-check
/**
 * Hook fast path: a unix-socket server hosted by the (always-running) plugin.
 *
 * Claude Code hook commands pipe their payload to this socket via `nc -U`
 * (~5ms) instead of spawning a fresh node process (~55ms), cutting event→glass
 * latency roughly in half. Protocol: first line = status word, remainder = the
 * hook's JSON payload. If the plugin isn't running the hook commands fall back
 * to `node hook.mjs <status>` — same logic either way (lib/hook-core.mjs).
 */
import net from "node:net";
import { existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
// Same repo, same logic as the fallback script — esbuild bundles the relative import.
import { processHookEvent } from "../../../adapters/claude-code/lib/hook-core.mjs";

export const HOOK_SOCK = join(homedir(), ".ulanzi-ai", "hook.sock");

export function startHookDaemon() {
  const server = net.createServer((conn) => {
    let buf = "";
    conn.on("data", (c) => { buf += c; });
    conn.on("end", async () => {
      const nl = buf.indexOf("\n");
      if (nl < 0) return;
      const status = buf.slice(0, nl).trim();
      let payload = null;
      try { payload = JSON.parse(buf.slice(nl + 1)); } catch { return; }
      try { await processHookEvent(status, payload); } catch {}
    });
    conn.on("error", () => {});
  });
  server.on("error", (e) => {
    // Stale socket file from a previous run: remove and retry once.
    if (/** @type {any} */ (e).code === "EADDRINUSE") {
      try { unlinkSync(HOOK_SOCK); server.listen(HOOK_SOCK); } catch {}
    }
  });
  try { if (existsSync(HOOK_SOCK)) unlinkSync(HOOK_SOCK); } catch {}
  try { server.listen(HOOK_SOCK); } catch {}
  return () => { try { server.close(); unlinkSync(HOOK_SOCK); } catch {} };
}
