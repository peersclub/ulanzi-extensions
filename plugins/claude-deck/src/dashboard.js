// @ts-check
/**
 * Popup dashboard: the plugin (full Node) renders ALL sessions into a single
 * self-refreshing HTML file; the Dashboard key opens it via $UD.openView.
 *
 * Unlike key faces (QSvg / SVG Tiny 1.2), this is a REAL web view — full CSS
 * (grid, animations, gradients) is available, so the dashboard can be rich.
 * The page reloads itself every 2s (scroll position preserved via
 * sessionStorage) and the plugin rewrites the file on every broker change.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DASH_PATH = join(homedir(), ".ulanzi-ai", "dashboard.html");

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const C = {
  bg: "#101014", card: "#1a1a1f", card2: "#222229", track: "#2c2c33", text: "#f2f2f5",
  dim: "#8b8b93", accent: "#d77757", good: "#3fb950", warn: "#e3b341", crit: "#f85149",
  info: "#58a6ff", plan: "#a371f7",
};

const STATUS = {
  error: { c: C.crit, label: "error", anim: false },
  awaiting_input: { c: C.warn, label: "needs you", anim: true },
  thinking: { c: C.info, label: "working", anim: true },
  tool: { c: C.info, label: "working", anim: true },
  done: { c: C.good, label: "done", anim: false },
  idle: { c: C.dim, label: "idle", anim: false },
};

const fmtTok = (n) => (n == null ? "—" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n));
const fmtCost = (c) => (c == null ? "—" : c >= 100 ? "$" + Math.round(c) : "$" + c.toFixed(2));
const ago = (t) => {
  if (!t) return "—";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.round(s / 60) + "m";
  return (s / 3600).toFixed(1) + "h";
};
const mmss = (secs) => {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

/** Inline sparkline SVG (webview = full SVG, this isn't QSvg-limited). */
function spark(values, color, w = 150, h = 34) {
  const vs = values.filter((v) => typeof v === "number");
  if (vs.length < 2) return `<span class="dim">no history</span>`;
  const min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1;
  const pts = vs.map((v, i) => `${((w - 4) * i) / (vs.length - 1) + 2},${h - 4 - ((v - min) / span) * (h - 8)}`).join(" ");
  const lastX = w - 2, lastY = h - 4 - ((vs[vs.length - 1] - min) / span) * (h - 8);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>
    <circle cx="${lastX}" cy="${lastY}" r="3" fill="${color}"/></svg>`;
}

function chip(text, color = C.dim, solid = false) {
  return solid
    ? `<span class="chip" style="background:${color};color:#111;border-color:${color}">${esc(text)}</span>`
    : `<span class="chip" style="color:${color};border-color:${color}44">${esc(text)}</span>`;
}

function gauge(pct, color) {
  const p = Math.max(0, Math.min(100, Math.round(pct ?? 0)));
  return `<div class="gauge"><div class="gauge-fill" style="width:${p}%;background:${color}"></div><span class="gauge-num">${p}%</span></div>`;
}

const isUnread = (s) => (s.finishedTs || 0) > Math.max(s.viewedTs || 0, s.activeTs || 0);

function sessionCard(s, i, current) {
  const cur = current && s.sessionId === current.sessionId;
  const live = Date.now() - (s.ts || 0) < 5 * 60 * 1000;
  const st = STATUS[live ? s.status || "idle" : "idle"] || STATUS.idle;
  const unread = isUnread(s);
  const ctxColor = (s.contextPct ?? 0) >= 90 ? C.crit : (s.contextPct ?? 0) >= 70 ? C.warn : C.good;
  const pctHist = (s.hist || []).map((h) => h.pct);
  const costHist = (s.hist || []).map((h) => h.cost);

  const askBanner = live && s.ask
    ? `<div class="ask">⚠ asking: <b>${esc(s.ask.type)}</b>${s.ask.tool ? ` · ${esc(s.ask.tool)}` : ""}${s.ask.cmd ? ` · <code>${esc(s.ask.cmd)}</code>` : ""}</div>`
    : "";

  const planBlock = live && s.plan?.steps?.length
    ? `<details class="plan"><summary>📋 pending plan — ${s.plan.steps.length} steps</summary>
       <ol>${s.plan.steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></details>`
    : "";

  return `<div class="card${cur ? " current" : ""}" style="--status:${st.c}">
    <div class="card-head">
      <span class="slot-num">${i + 1}</span>
      <span class="sess-name">${esc(s.name || "?")}</span>
      ${cur && current.pinned ? `<span title="pinned">📌</span>` : ""}
      ${unread ? `<span class="unread-dot" title="unread result"></span>` : ""}
      <span class="status-pill${st.anim ? " pulse" : ""}">${st.label}</span>
    </div>
    ${askBanner}
    <div class="meta">
      ${chip(s.model || "model —", C.accent)}
      ${chip(s.mode || "mode —", s.mode === "bypassPermissions" ? C.crit : s.mode === "default" ? C.info : C.warn)}
      ${chip("effort " + (s.effort || "—"), C.plan)}
      ${s.tty ? chip(s.tty, C.dim) : ""}
    </div>
    <div class="grid2">
      <div><label>context</label>${gauge(s.contextPct, ctxColor)}<div class="sub">${fmtTok(s.tokensUsed)}${s.tokensWindow ? " / " + fmtTok(s.tokensWindow) : ""} tokens</div></div>
      <div><label>cost</label><div class="big">${fmtCost(s.costSession)}</div><div class="sub">${s.linesChanged != null ? (s.linesChanged > 0 ? "+" : "") + s.linesChanged + " lines" : ""}</div></div>
      <div><label>ctx trend</label>${spark(pctHist, C.accent)}</div>
      <div><label>burn</label>${spark(costHist, C.good)}</div>
    </div>
    ${planBlock}
    <div class="foot">
      <span title="working directory">${esc(s.cwd || "")}</span>
      <span>${s.lastTool ? "⚙ " + esc(s.lastTool) + " · " : ""}session ${mmss(s.sessionSecs)} · active ${ago(s.activeTs)} ago · write ${ago(s.ts)} ago</span>
    </div>
  </div>`;
}

/**
 * @param {Array<any>} sessions (wide window, sorted by recency)
 * @param {any} current currentSession() result (may be null)
 */
export function renderDashboard(sessions, current) {
  // Current session first, then by last interaction.
  const ordered = [...sessions].sort((a, b) => {
    const ac = current && a.sessionId === current.sessionId ? 1 : 0;
    const bc = current && b.sessionId === current.sessionId ? 1 : 0;
    if (ac !== bc) return bc - ac;
    return (b.activeTs || b.ts || 0) - (a.activeTs || a.ts || 0);
  });

  const now = Date.now();
  const live = sessions.filter((s) => now - (s.ts || 0) < 5 * 60 * 1000);
  const working = live.filter((s) => s.status === "thinking" || s.status === "tool").length;
  const waiting = live.filter((s) => s.status === "awaiting_input").length;
  const unreadN = sessions.filter(isUnread).length;
  const totCost = live.reduce((a, s) => a + (s.costSession || 0), 0);
  const totTok = live.reduce((a, s) => a + (s.tokensUsed || 0), 0);

  const kpi = (label, value, color = C.text, sub = "") =>
    `<div class="kpi"><div class="kpi-v" style="color:${color}">${value}</div><div class="kpi-l">${label}</div>${sub ? `<div class="kpi-s">${sub}</div>` : ""}</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Claude Fleet</title>
<style>
  * { box-sizing: border-box; }
  body { background:${C.bg}; color:${C.text}; font:14px/1.45 -apple-system,Helvetica,sans-serif; padding:22px; margin:0; }
  h1 { font-size:19px; margin:0 0 4px; display:flex; align-items:baseline; gap:10px; }
  h1 .when { color:${C.dim}; font-weight:400; font-size:12px; }
  .acct { color:${C.dim}; font-size:12.5px; margin-bottom:16px; }
  .kpis { display:flex; gap:12px; margin-bottom:18px; flex-wrap:wrap; }
  .kpi { background:${C.card}; border:1px solid ${C.track}; border-radius:14px; padding:12px 18px; min-width:110px; }
  .kpi-v { font-size:24px; font-weight:800; }
  .kpi-l { color:${C.dim}; font-size:11px; text-transform:uppercase; letter-spacing:.05em; margin-top:2px; }
  .kpi-s { color:${C.dim}; font-size:11px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(360px,1fr)); gap:14px; }
  .card { background:${C.card}; border:1px solid ${C.track}; border-left:5px solid var(--status);
          border-radius:14px; padding:14px 16px; }
  .card.current { box-shadow:0 0 0 2px ${C.accent}66; background:${C.card2}; }
  .card-head { display:flex; align-items:center; gap:9px; margin-bottom:9px; }
  .slot-num { background:${C.track}; border-radius:7px; padding:1px 8px; font-weight:800; font-size:12px; color:${C.dim}; }
  .sess-name { font-weight:800; font-size:16.5px; }
  .status-pill { margin-left:auto; background:var(--status); color:#111; font-weight:700; font-size:11px;
                 padding:2.5px 10px; border-radius:99px; }
  .pulse { animation:pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity:.45; } }
  .unread-dot { width:10px; height:10px; border-radius:50%; background:${C.good}; display:inline-block;
                animation:pulse 1.6s ease-in-out infinite; }
  .ask { background:${C.warn}; color:#111; border-radius:9px; padding:7px 11px; font-size:12.5px; margin-bottom:9px; }
  .ask code { background:rgba(0,0,0,.15); padding:1px 5px; border-radius:4px; }
  .meta { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:11px; }
  .chip { border:1px solid; border-radius:99px; padding:1.5px 9px; font-size:11px; font-weight:600; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:10px 16px; }
  label { display:block; color:${C.dim}; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; margin-bottom:3px; }
  .big { font-size:21px; font-weight:800; }
  .sub, .dim { color:${C.dim}; font-size:11.5px; }
  .gauge { position:relative; background:${C.track}; border-radius:99px; height:16px; overflow:hidden; }
  .gauge-fill { height:100%; border-radius:99px; transition:width .3s; }
  .gauge-num { position:absolute; right:7px; top:0; font-size:10.5px; font-weight:700; line-height:16px; }
  .plan { margin-top:10px; background:${C.bg}; border:1px solid ${C.plan}55; border-radius:10px; padding:8px 12px; }
  .plan summary { cursor:pointer; color:${C.plan}; font-weight:700; font-size:12.5px; }
  .plan ol { margin:8px 0 4px; padding-left:20px; font-size:12.5px; }
  .foot { display:flex; justify-content:space-between; gap:10px; color:${C.dim}; font-size:11px;
          margin-top:11px; border-top:1px solid ${C.track}; padding-top:8px; flex-wrap:wrap; }
</style></head><body>
<h1>🎛 Claude Fleet <span class="when">${new Date().toLocaleTimeString()}</span></h1>
<div class="acct">${current?.account ? `👤 ${esc(current.account)}${current.accountOrg ? " · " + esc(current.accountOrg) : ""}` : ""}</div>
<div class="kpis">
  ${kpi("live sessions", live.length, C.info)}
  ${kpi("working", working, C.info)}
  ${kpi("need you", waiting, waiting ? C.warn : C.dim)}
  ${kpi("unread", unreadN, unreadN ? C.good : C.dim)}
  ${kpi("session cost", fmtCost(totCost), totCost >= 10 ? C.crit : C.good, "across live sessions")}
  ${kpi("ctx tokens", fmtTok(totTok), C.accent, "in use now")}
</div>
<div class="cards">
${ordered.map((s, i) => sessionCard(s, i, current)).join("\n") || `<div class="dim">No sessions in the last 2 hours.</div>`}
</div>
<script>
  // Preserve scroll + open-plan state across the 2s self-refresh.
  addEventListener("beforeunload", () => sessionStorage.setItem("y", String(scrollY)));
  const y = +sessionStorage.getItem("y") || 0; if (y) scrollTo(0, y);
  setTimeout(() => location.reload(), 2000);
</script>
</body></html>`;
}

/** Write the dashboard file (atomic-ish; the webview reload tolerates races). */
export function writeDashboard(sessions, current) {
  try {
    mkdirSync(join(homedir(), ".ulanzi-ai"), { recursive: true });
    writeFileSync(DASH_PATH, renderDashboard(sessions, current));
  } catch {}
}
