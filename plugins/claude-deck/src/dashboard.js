// @ts-check
/**
 * Popup dashboard: the plugin (full Node) renders ALL sessions into a single
 * self-refreshing HTML file; the Dashboard key opens it via $UD.openView.
 * The webview has no fs/network access it needs — the file reloads itself and
 * the plugin rewrites it on every broker change, so the popup stays live.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DASH_PATH = join(homedir(), ".ulanzi-ai", "dashboard.html");

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const C = {
  bg: "#141417", card: "#1f1f23", track: "#2c2c33", text: "#ffffff", dim: "#8b8b93",
  accent: "#d77757", good: "#3fb950", warn: "#e3b341", crit: "#f85149", info: "#58a6ff", plan: "#a371f7",
};

const statusColor = (s) =>
  s.status === "error" ? C.crit :
  s.status === "awaiting_input" ? C.warn :
  s.status === "thinking" || s.status === "tool" ? C.info : C.dim;

const fmtTok = (n) => (n == null ? "—" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n));
const fmtCost = (c) => (c == null ? "—" : c >= 100 ? "$" + Math.round(c) : "$" + c.toFixed(2));
const ago = (t) => (!t ? "—" : Math.max(0, Math.round((Date.now() - t) / 1000)) + "s ago");

/**
 * @param {Array<any>} sessions live sessions (slot order)
 * @param {any} current currentSession() result (may be null)
 */
export function renderDashboard(sessions, current) {
  const rows = sessions.map((s, i) => {
    const cur = current && s.sessionId === current.sessionId;
    const unread = (s.finishedTs || 0) > Math.max(s.viewedTs || 0, s.activeTs || 0);
    const spark = (s.hist || []).map((h) => h.pct).filter((v) => typeof v === "number");
    const sparkSvg = spark.length > 1
      ? `<svg width="120" height="28" viewBox="0 0 120 28"><polyline fill="none" stroke="${C.accent}" stroke-width="2" points="${spark
          .map((v, j) => `${(120 * j) / (spark.length - 1)},${26 - (v / 100) * 24}`).join(" ")}"/></svg>`
      : "—";
    return `<tr${cur ? ` style="outline:2px solid ${C.accent}"` : ""}>
      <td><b>${i + 1}</b></td>
      <td><b>${esc(s.name)}</b>${cur && current.pinned ? " 📌" : ""}${unread ? ` <span style="color:${C.good}">●</span>` : ""}</td>
      <td><span style="color:${statusColor(s)}">●</span> ${esc(s.status || "idle")}${s.lastTool ? ` <span style="color:${C.dim}">(${esc(s.lastTool)})</span>` : ""}</td>
      <td>${esc(s.mode || "—")}</td>
      <td>${esc(s.effort || "—")}</td>
      <td>${s.contextPct != null ? s.contextPct + "%" : "—"}</td>
      <td>${fmtTok(s.tokensUsed)}</td>
      <td>${fmtCost(s.costSession)}</td>
      <td>${sparkSvg}</td>
      <td style="color:${C.dim}">${ago(s.ts)}</td>
    </tr>`;
  }).join("\n");

  const plan = current?.plan?.steps?.length
    ? `<h2 style="color:${C.plan}">Pending plan — ${current.plan.steps.length} steps</h2>
       <ol>${current.plan.steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>`
    : "";

  const ask = current?.ask
    ? `<p style="background:${C.warn};color:#111;padding:8px 12px;border-radius:8px;display:inline-block">
       ⚠ <b>${esc(current.name)}</b> is asking: ${esc(current.ask.type)}${current.ask.tool ? ` · ${esc(current.ask.tool)}` : ""}${current.ask.cmd ? ` · <code>${esc(current.ask.cmd)}</code>` : ""}</p>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Claude Fleet</title>
<style>
  body{background:${C.bg};color:${C.text};font:14px -apple-system,Helvetica,sans-serif;padding:20px}
  h1{font-size:18px} h2{font-size:15px}
  table{border-collapse:collapse;width:100%;background:${C.card};border-radius:10px;overflow:hidden}
  th,td{padding:8px 12px;text-align:left;border-bottom:1px solid ${C.track}}
  th{color:${C.dim};font-weight:600;text-transform:uppercase;font-size:11px}
  code{background:${C.track};padding:1px 5px;border-radius:4px}
  ol{line-height:1.7}
</style></head><body>
<h1>🎛 Claude Fleet <span style="color:${C.dim};font-weight:400">· ${sessions.length} live · ${new Date().toLocaleTimeString()}</span></h1>
${ask}
<table><tr><th>#</th><th>Session</th><th>Status</th><th>Mode</th><th>Effort</th><th>Ctx</th><th>Tokens</th><th>Cost</th><th>Ctx trend</th><th>Last write</th></tr>
${rows || `<tr><td colspan="10" style="color:${C.dim}">No live sessions</td></tr>`}</table>
${plan}
<script>setTimeout(()=>location.reload(),2000)</script>
</body></html>`;
}

/** Write the dashboard file (atomic-ish; the webview reload tolerates races). */
export function writeDashboard(sessions, current) {
  try {
    mkdirSync(join(homedir(), ".ulanzi-ai"), { recursive: true });
    writeFileSync(DASH_PATH, renderDashboard(sessions, current));
  } catch {}
}
