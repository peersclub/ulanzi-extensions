// Compute context-window usage from a Claude Code transcript.
//
// The statusline payload doesn't reliably carry context %, but the transcript
// JSONL does: each assistant message has a `usage` block. Context footprint is
// input_tokens + cache_creation_input_tokens + cache_read_input_tokens (output
// tokens don't occupy the input window). We read only the tail of the file since
// the latest usage is near the end.
import { open, stat } from "node:fs/promises";

const TAIL_BYTES = 512 * 1024;

// Known context windows. Default 200k; 1M for the long-context variants. If the
// measured usage exceeds 200k we assume a 1M window (a coarse but safe guess).
function windowFor(model, usedTokens) {
  const m = (model || "").toLowerCase();
  if (m.includes("1m") || usedTokens > 200_000) return 1_000_000;
  return 200_000;
}

function usageOf(obj) {
  const u = obj?.message?.usage || obj?.usage;
  if (!u) return null;
  const used =
    (u.input_tokens || 0) +
    (u.cache_creation_input_tokens || 0) +
    (u.cache_read_input_tokens || 0);
  return used > 0 ? { used, model: obj?.message?.model } : null;
}

/**
 * @param {string} transcriptPath
 * @returns {Promise<{usedTokens:number, windowTokens:number, pct:number, model?:string} | null>}
 */
export async function contextFromTranscript(transcriptPath) {
  if (!transcriptPath) return null;
  let fh;
  try {
    const { size } = await stat(transcriptPath);
    if (!size) return null;
    fh = await open(transcriptPath, "r");
    const len = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, size - len);
    const text = buf.toString("utf8");
    // Drop a possibly-partial first line when we didn't start at byte 0.
    const lines = text.split("\n");
    if (size > len) lines.shift();
    // Scan from the end for the most recent parseable usage.
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line || !line.includes('"usage"')) continue;
      try {
        const hit = usageOf(JSON.parse(line));
        if (hit) {
          const windowTokens = windowFor(hit.model, hit.used);
          return {
            usedTokens: hit.used,
            windowTokens,
            pct: Math.min(100, Math.round((hit.used / windowTokens) * 100)),
            model: hit.model,
          };
        }
      } catch {
        /* partial/non-JSON line — keep scanning */
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    await fh?.close();
  }
}
