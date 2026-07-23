// @ts-check
/**
 * Zero-dependency SVG tile kit for UlanziDeck keys.
 *
 * Rationale: UlanziDeck keys render an SVG passed as a base64 `data:` URI to
 * `$UD.setBaseDataIcon`. So a "tile" is just a function that returns that URI.
 * We avoid canvas/native modules entirely — SVG strings bundle cleanly into the
 * single `dist/app.js` the runtime executes (see docs/CONVENTIONS.md).
 *
 * Geometry matches the device: a 200x200 canvas (confirmed from Ulanzi's own
 * plugins). All tiles share one visual language so a deck built from them reads
 * as a single system.
 */

export const SIZE = 200;

/** Shared palette. `accent` defaults to Claude's brand orange. */
export const palette = {
  bg: "#1f1f23",
  track: "#2c2c33",
  text: "#ffffff",
  dim: "#8b8b93",
  accent: "#d77757", // Claude orange
  good: "#3fb950",
  warn: "#e3b341",
  crit: "#f85149",
  info: "#58a6ff",
  plan: "#a371f7",
};

/** Map a broker SessionStatus to a color + short glyph label. */
export const statusStyle = {
  idle: { color: palette.dim, glyph: "○", label: "idle" },
  thinking: { color: palette.info, glyph: "✳", label: "thinking" },
  tool: { color: palette.accent, glyph: "⚙", label: "tool" },
  awaiting_input: { color: palette.warn, glyph: "!", label: "input" },
  done: { color: palette.good, glyph: "✓", label: "done" },
  error: { color: palette.crit, glyph: "✕", label: "error" },
};

export function escapeXml(/** @type {unknown} */ s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function toDataUrl(/** @type {string} */ svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function doc(/** @type {string} */ body, /** @type {string} */ bg = palette.bg) {
  return toDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">` +
      `<rect width="${SIZE}" height="${SIZE}" rx="24" fill="${bg}"/>${body}</svg>`
  );
}

const FONT = "-apple-system,Helvetica,Arial,sans-serif";

/** Usable width inside a key (200 minus side padding). */
const FIT_W = 176;

/**
 * Pick a font size so `text` fits within `maxW` px at the given weight, clamped
 * to [min, max]. QSvg (SVG Tiny 1.2) can't auto-fit via textLength, so we
 * estimate: a bold sans glyph averages ~0.62em wide. Prevents the "Opus 4.8"
 * -> "8" overflow-clipping on long values.
 */
function fitSize(text, max, { maxW = FIT_W, min = 16 } = {}) {
  const len = String(text ?? "").length || 1;
  return Math.max(min, Math.min(max, Math.floor(maxW / (len * 0.62))));
}

/** Truncate with an ellipsis so a value can't run past the key edge. */
function ellipsize(text, n) {
  const s = String(text ?? "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Centered text with a subtle shadow (legible on any background).
 * @param {{x:number,y:number,size:number,text:string|number,weight?:number,anchor?:string,fill?:string}} o
 */
function label(o) {
  const t = escapeXml(o.text);
  const w = o.weight ?? 600;
  const a = o.anchor ?? "middle";
  const fill = o.fill ?? palette.text;
  const common = `font-family="${FONT}" font-size="${o.size}" font-weight="${w}" text-anchor="${a}"`;
  // NOTE: use rgba(), not 8-digit hex (#RRGGBBAA). Ulanzi Studio renders keys with
  // Qt's QSvg engine (SVG Tiny 1.2), which does not support 8-digit hex and will
  // silently drop the whole tile to the static icon. See docs/CONVENTIONS.md.
  return (
    `<text x="${o.x + 1.5}" y="${o.y + 1.5}" ${common} fill="rgba(0,0,0,0.55)">${t}</text>` +
    `<text x="${o.x}" y="${o.y}" ${common} fill="${fill}">${t}</text>`
  );
}

/** A thin accent stripe across the top — used to tag a tile's family/tool. */
function stripe(/** @type {string} */ color) {
  return `<rect x="0" y="0" width="${SIZE}" height="8" rx="4" fill="${color}"/>`;
}

/**
 * KPI tile: a small caption over a big value, optional sub-line.
 * @param {{title:string, value:string|number, sub?:string, accent?:string}} o
 */
export function KpiTile({ title, value, sub, accent = palette.accent }) {
  const hasSub = sub != null && sub !== "";
  const vSize = fitSize(value, 62); // shrink long values instead of clipping them
  return doc(
    stripe(accent) +
      label({ x: SIZE / 2, y: 52, size: fitSize(title.toUpperCase(), 26), text: title.toUpperCase(), weight: 700, fill: palette.dim }) +
      label({ x: SIZE / 2, y: hasSub ? 118 : 130, size: vSize, text: value, weight: 800 }) +
      (hasSub ? label({ x: SIZE / 2, y: 162, size: fitSize(sub, 26), text: sub, fill: palette.dim }) : "")
  );
}

/**
 * Status dot: a large colored ring with glyph + label. Driven by SessionStatus.
 * Pass `frame` (a monotonically increasing integer) to animate the ring as a
 * rotating spinner — used for the "working" states so the deck feels alive.
 * QSvg-safe: a stroked circle with stroke-dasharray + a rotate transform.
 * @param {{status: keyof typeof statusStyle, sub?: string, stale?: boolean, frame?: number}} o
 */
export function StatusDot({ status, sub, stale, frame }) {
  const s = statusStyle[status] || statusStyle.idle;
  const color = stale ? palette.dim : s.color;
  const cx = SIZE / 2;
  const cy = 86;
  const r = 46;
  const ring =
    frame == null
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10"/>`
      : // spinner: faint track + a rotating ~90° arc
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${palette.track}" stroke-width="10"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" ` +
        `stroke-dasharray="72 217" transform="rotate(${(frame * 45) % 360} ${cx} ${cy})"/>`;
  return doc(
    ring +
      label({ x: cx, y: 104, size: 52, text: s.glyph, weight: 800, fill: color }) +
      label({ x: cx, y: 168, size: fitSize(sub ?? s.label, 28), text: ellipsize(sub ?? s.label, 16), weight: 700, fill: stale ? palette.dim : palette.text })
  );
}

/**
 * Gauge tile: a horizontal fill bar (0-100) with the pct value, auto-colored by
 * threshold unless an accent is forced.
 * @param {{label:string, pct:number, accent?:string, sub?:string}} o
 */
export function GaugeTile({ label: cap, pct, accent, sub }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const color =
    accent || (clamped >= 90 ? palette.crit : clamped >= 70 ? palette.warn : palette.good);
  const barY = 92;
  const barW = (SIZE - 40) * (clamped / 100);
  return doc(
    label({ x: SIZE / 2, y: 48, size: 26, text: cap.toUpperCase(), weight: 700, fill: palette.dim }) +
      `<rect x="20" y="${barY}" width="${SIZE - 40}" height="20" rx="10" fill="${palette.track}"/>` +
      `<rect x="20" y="${barY}" width="${barW}" height="20" rx="10" fill="${color}"/>` +
      label({ x: SIZE / 2, y: 156, size: 44, text: `${clamped}%`, weight: 800 }) +
      (sub ? label({ x: SIZE / 2, y: 184, size: fitSize(sub, 22), text: ellipsize(sub, 22), fill: palette.dim }) : "")
  );
}

/**
 * Sparkline tile: a tiny history line for a series of numbers.
 * @param {{label:string, values:number[], accent?:string, value?:string|number}} o
 */
export function SparkTile({ label: cap, values, accent = palette.accent, value }) {
  const pad = 20;
  const w = SIZE - pad * 2;
  const h = 60;
  const top = 96;
  const vs = values.length ? values : [0, 0];
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const pts = vs
    .map((v, i) => {
      const x = pad + (w * i) / (vs.length - 1 || 1);
      const y = top + h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return doc(
    label({ x: SIZE / 2, y: 48, size: 26, text: cap.toUpperCase(), weight: 700, fill: palette.dim }) +
      (value != null ? label({ x: SIZE / 2, y: 82, size: fitSize(value, 34), text: value, weight: 800 }) : "") +
      `<polyline points="${pts}" fill="none" stroke="${accent}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`
  );
}

/**
 * Name tile: which session/terminal the deck is currently following. Font size
 * adapts to length and long names are truncated so they always fit the key.
 * @param {{name:string, sub?:string, accent?:string, dim?:boolean}} o
 */
export function NameTile({ name, sub, accent = palette.accent, dim }) {
  const short = ellipsize(name || "—", 16);
  return doc(
    stripe(dim ? palette.dim : accent) +
      label({ x: SIZE / 2, y: 56, size: 24, text: "SESSION", weight: 700, fill: palette.dim }) +
      label({ x: SIZE / 2, y: 120, size: fitSize(short, 50), text: short, weight: 800, fill: dim ? palette.dim : palette.text }) +
      (sub ? label({ x: SIZE / 2, y: 164, size: fitSize(sub, 24), text: ellipsize(sub, 20), fill: palette.dim }) : "")
  );
}

/**
 * Slot tile: one live session on one key, Codex-Micro style — the whole key is
 * a colored "frosted" status light with the session name on it.
 * Color priority: error (red) > needs input/ask (amber) > unread result (green)
 * > working (blue) > idle/read (dim). Press behavior lives in the deck action.
 * @param {{slot?:number, name?:string, status?:string, unread?:boolean, pinned?:boolean, empty?:boolean}} o
 */
export function SlotTile({ slot, name, status, unread, pinned, empty }) {
  let bg = palette.bg;
  let word = "empty";
  if (!empty) {
    if (status === "error") { bg = palette.crit; word = "error"; }
    else if (status === "awaiting_input") { bg = palette.warn; word = "needs you"; }
    else if (unread) { bg = palette.good; word = "unread"; }
    else if (status === "thinking" || status === "tool") { bg = palette.info; word = "working"; }
    else { bg = palette.track; word = status || "idle"; }
  }
  const lit = !empty && bg !== palette.track && bg !== palette.bg;
  const chip =
    slot != null
      ? `<rect x="10" y="10" width="34" height="30" rx="8" fill="rgba(0,0,0,0.35)"/>` +
        label({ x: 27, y: 32, size: 20, text: String(slot), weight: 800 })
      : "";
  const disp = ellipsize((pinned ? "📌" : "") + (empty ? "—" : name || "?"), 14);
  return doc(
    chip +
      label({ x: SIZE / 2, y: 112, size: fitSize(disp, 40), text: disp, weight: 800, fill: empty ? palette.dim : palette.text }) +
      label({ x: SIZE / 2, y: 168, size: fitSize(word.toUpperCase(), 24), text: word.toUpperCase(), weight: 700, fill: lit ? "rgba(0,0,0,0.55)" : palette.dim }),
    bg
  );
}

/**
 * Plan hero tile: "PLAN READY" + step count, shown when Claude presents a plan.
 * @param {{steps?: string[], dim?: boolean}} o
 */
export function PlanHeroTile({ steps, dim }) {
  const n = Array.isArray(steps) ? steps.length : 0;
  const color = dim || !n ? palette.dim : palette.plan;
  return doc(
    stripe(color) +
      label({ x: SIZE / 2, y: 66, size: 30, text: n ? "PLAN READY" : "PLAN", weight: 800, fill: color }) +
      label({ x: SIZE / 2, y: 128, size: 66, text: n ? String(n) : "—", weight: 800 }) +
      (n ? label({ x: SIZE / 2, y: 168, size: 24, text: n === 1 ? "step" : "steps", fill: palette.dim }) : "")
  );
}

/**
 * Plan step tile: one step of the plan, for the encoder dial-through.
 * @param {{index?: number, total?: number, text?: string}} o
 */
export function PlanStepTile({ index = 0, total = 0, text = "" }) {
  const words = String(text).split(" ");
  // wrap the step text across up to 3 lines that each fit the key
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 16 && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
    if (lines.length === 3) break;
  }
  if (cur && lines.length < 3) lines.push(cur);
  const body = lines
    .slice(0, 3)
    .map((ln, i) => label({ x: SIZE / 2, y: 96 + i * 30, size: 24, text: ellipsize(ln, 18), weight: 600 }))
    .join("");
  return doc(
    stripe(palette.plan) +
      label({ x: SIZE / 2, y: 52, size: 26, text: `STEP ${index + 1}/${total}`, weight: 700, fill: palette.plan }) +
      body
  );
}

/** Permission mode → label + color, so it's obvious why a session does/doesn't prompt. */
export const modeStyle = {
  default: { label: "ASK", color: palette.info, hint: "prompts you" },
  auto: { label: "AUTO", color: palette.warn, hint: "auto-accepting" },
  acceptEdits: { label: "AUTO EDIT", color: palette.warn, hint: "auto-accepts edits" },
  plan: { label: "PLAN", color: palette.plan, hint: "planning only" },
  bypassPermissions: { label: "BYPASS", color: palette.crit, hint: "skips all prompts" },
};

/**
 * Mode tile: the session's permission mode, color-coded. Amber/red = auto (won't
 * prompt), blue = asks. Answers "why isn't it asking me?" at a glance.
 * @param {{mode?: string}} o
 */
export function ModeTile({ mode }) {
  const s = modeStyle[mode] || { label: mode ? String(mode).toUpperCase() : "—", color: palette.dim, hint: "" };
  return doc(
    stripe(s.color) +
      label({ x: SIZE / 2, y: 52, size: 26, text: "MODE", weight: 700, fill: palette.dim }) +
      label({ x: SIZE / 2, y: 116, size: fitSize(s.label, 52), text: s.label, weight: 800, fill: s.color }) +
      (s.hint ? label({ x: SIZE / 2, y: 162, size: fitSize(s.hint, 22), text: s.hint, fill: palette.dim }) : "")
  );
}

/**
 * Action tile: a glyph + caption for a control button (interrupt, approve, ...).
 * Optional `sub` (e.g. the tool being asked about) and `dim` (inactive/contextual
 * key with nothing to act on).
 * @param {{glyph:string, caption:string, accent?:string, sub?:string, dim?:boolean}} o
 */
export function ActionTile({ glyph, caption, accent = palette.accent, sub, dim }) {
  const gc = dim ? palette.dim : accent;
  const tc = dim ? palette.dim : palette.text;
  const gy = sub ? 96 : 108;
  return doc(
    label({ x: SIZE / 2, y: gy, size: 74, text: glyph, weight: 700, fill: gc }) +
      label({ x: SIZE / 2, y: 156, size: fitSize(caption.toUpperCase(), 28), text: caption.toUpperCase(), weight: 700, fill: tc }) +
      (sub ? label({ x: SIZE / 2, y: 184, size: fitSize(sub, 22), text: ellipsize(sub, 20), fill: palette.dim }) : "")
  );
}
