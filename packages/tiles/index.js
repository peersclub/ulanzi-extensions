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
  return doc(
    stripe(accent) +
      label({ x: SIZE / 2, y: 52, size: 26, text: title.toUpperCase(), weight: 700, fill: palette.dim }) +
      label({ x: SIZE / 2, y: hasSub ? 118 : 130, size: 66, text: value, weight: 800 }) +
      (hasSub ? label({ x: SIZE / 2, y: 162, size: 26, text: sub, fill: palette.dim }) : "")
  );
}

/**
 * Status dot: a large colored ring with glyph + label. Driven by SessionStatus.
 * @param {{status: keyof typeof statusStyle, sub?: string, stale?: boolean}} o
 */
export function StatusDot({ status, sub, stale }) {
  const s = statusStyle[status] || statusStyle.idle;
  const color = stale ? palette.dim : s.color;
  const cx = SIZE / 2;
  return doc(
    `<circle cx="${cx}" cy="86" r="46" fill="none" stroke="${color}" stroke-width="10"/>` +
      label({ x: cx, y: 104, size: 52, text: s.glyph, weight: 800, fill: color }) +
      label({ x: cx, y: 168, size: 28, text: sub ?? s.label, weight: 700, fill: stale ? palette.dim : palette.text })
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
      (sub ? label({ x: SIZE / 2, y: 184, size: 22, text: sub, fill: palette.dim }) : "")
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
      (value != null ? label({ x: SIZE / 2, y: 82, size: 34, text: value, weight: 800 }) : "") +
      `<polyline points="${pts}" fill="none" stroke="${accent}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`
  );
}

/**
 * Name tile: which session/terminal the deck is currently following. Font size
 * adapts to length and long names are truncated so they always fit the key.
 * @param {{name:string, sub?:string, accent?:string, dim?:boolean}} o
 */
export function NameTile({ name, sub, accent = palette.accent, dim }) {
  const n = String(name || "—");
  const short = n.length > 12 ? n.slice(0, 11) + "…" : n;
  const size = short.length > 9 ? 30 : short.length > 6 ? 40 : 50;
  return doc(
    stripe(dim ? palette.dim : accent) +
      label({ x: SIZE / 2, y: 56, size: 24, text: "SESSION", weight: 700, fill: palette.dim }) +
      label({ x: SIZE / 2, y: 120, size, text: short, weight: 800, fill: dim ? palette.dim : palette.text }) +
      (sub ? label({ x: SIZE / 2, y: 164, size: 24, text: sub, fill: palette.dim }) : "")
  );
}

/**
 * Action tile: a glyph + caption for a control button (interrupt, approve, ...).
 * @param {{glyph:string, caption:string, accent?:string}} o
 */
export function ActionTile({ glyph, caption, accent = palette.accent }) {
  return doc(
    label({ x: SIZE / 2, y: 108, size: 78, text: glyph, weight: 700, fill: accent }) +
      label({ x: SIZE / 2, y: 168, size: 28, text: caption.toUpperCase(), weight: 700 })
  );
}
