#!/usr/bin/env node
// Generate distinct action icons for the Claude Deck plugin.
//
// Design language: dark rounded tile, one bold colored glyph/shape per action,
// an amber bottom bar marks CONTEXTUAL keys, a small arc marks ENCODER dials.
// Authored as SVG (same aesthetic as the live tiles), rasterized to PNG via
// macOS Quick Look (qlmanage) — no native deps.
//
//   node tools/gen-icons.mjs            # writes plugins/claude-deck/resources/actions/*.png
//                                       # and updates manifest.json icon paths
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, renameSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = join(REPO, "plugins/claude-deck");
const OUT = join(PLUGIN, "resources/actions");

const C = {
  bg: "#1f1f23", track: "#2c2c33", text: "#ffffff", dim: "#8b8b93",
  accent: "#d77757", good: "#3fb950", warn: "#e3b341", crit: "#f85149",
  info: "#58a6ff", plan: "#a371f7",
};

const S = 144;
const glyph = (t, color, size = 78, y = 96) =>
  `<text x="72" y="${y}" font-family="-apple-system,Helvetica" font-size="${size}" font-weight="700" text-anchor="middle" fill="${color}">${t}</text>`;
const contextualBar = `<rect x="24" y="122" width="96" height="10" rx="5" fill="${C.warn}"/>`;
const dialArc = `<path d="M 40 126 A 40 40 0 0 1 104 126" fill="none" stroke="${C.dim}" stroke-width="8" stroke-linecap="round"/>`;

/** Custom shape bodies (things a glyph can't say). */
const shapes = {
  gauge: `<rect x="24" y="60" width="96" height="22" rx="11" fill="${C.track}"/><rect x="24" y="60" width="62" height="22" rx="11" fill="${C.good}"/>`,
  ring: `<circle cx="72" cy="66" r="30" fill="none" stroke="${C.info}" stroke-width="12"/>`,
  clock: `<circle cx="72" cy="70" r="34" fill="none" stroke="${C.accent}" stroke-width="10"/><path d="M72 52 L72 72 L88 80" stroke="${C.text}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
  spark: `<polyline points="24,92 48,76 68,84 92,52 120,64" fill="none" stroke="${C.accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
  sparkCost: `<polyline points="24,96 52,86 78,70 120,44" fill="none" stroke="${C.good}" stroke-width="10" stroke-linecap="round"/><text x="40" y="60" font-family="-apple-system" font-size="44" font-weight="800" fill="${C.good}">$</text>`,
  list: `<rect x="30" y="36" width="84" height="12" rx="6" fill="${C.plan}"/><rect x="30" y="64" width="84" height="12" rx="6" fill="${C.plan}" opacity="0.7"/><rect x="30" y="92" width="60" height="12" rx="6" fill="${C.plan}" opacity="0.45"/>`,
  grid: `<rect x="28" y="28" width="38" height="38" rx="9" fill="${C.info}"/><rect x="78" y="28" width="38" height="38" rx="9" fill="${C.good}"/><rect x="28" y="78" width="38" height="38" rx="9" fill="${C.warn}"/><rect x="78" y="78" width="38" height="38" rx="9" fill="${C.crit}"/>`,
  radar: `<circle cx="72" cy="72" r="18" fill="${C.warn}"/><circle cx="72" cy="72" r="34" fill="none" stroke="${C.warn}" stroke-width="7" opacity="0.55"/><circle cx="72" cy="72" r="50" fill="none" stroke="${C.warn}" stroke-width="6" opacity="0.3"/>`,
  speedo: `<path d="M 30 96 A 46 46 0 0 1 114 96" fill="none" stroke="${C.track}" stroke-width="12" stroke-linecap="round"/><path d="M 30 96 A 46 46 0 0 1 96 55" fill="none" stroke="${C.plan}" stroke-width="12" stroke-linecap="round"/><circle cx="72" cy="94" r="9" fill="${C.text}"/><path d="M72 94 L98 62" stroke="${C.text}" stroke-width="8" stroke-linecap="round"/>`,
  slot: `<rect x="34" y="30" width="76" height="76" rx="16" fill="${C.info}"/><text x="72" y="86" font-family="-apple-system" font-size="52" font-weight="800" text-anchor="middle" fill="#111">1</text>`,
  fleet: `<rect x="26" y="40" width="28" height="28" rx="7" fill="${C.info}"/><rect x="60" y="40" width="28" height="28" rx="7" fill="${C.warn}"/><rect x="94" y="40" width="28" height="28" rx="7" fill="${C.good}"/><path d="M 46 100 A 30 22 0 0 1 98 100" fill="none" stroke="${C.dim}" stroke-width="8" stroke-linecap="round"/><path d="M98 100 l10 -12 M98 100 l-14 -6" stroke="${C.dim}" stroke-width="8" stroke-linecap="round" fill="none"/>`,
  stop: `<rect x="42" y="42" width="60" height="60" rx="12" fill="${C.crit}"/>`,
  terminal: `<rect x="26" y="34" width="92" height="72" rx="12" fill="none" stroke="${C.info}" stroke-width="8"/><text x="44" y="86" font-family="Menlo,monospace" font-size="40" font-weight="700" fill="${C.info}">&#10095;_</text>`,
  shield: `<path d="M72 26 L110 42 L110 78 Q110 108 72 122 Q34 108 34 78 L34 42 Z" fill="none" stroke="${C.warn}" stroke-width="9"/><text x="72" y="90" font-family="-apple-system" font-size="42" font-weight="800" text-anchor="middle" fill="${C.warn}">?</text>`,
  deckLogo: `<rect x="26" y="26" width="42" height="42" rx="10" fill="${C.accent}"/><rect x="76" y="26" width="42" height="42" rx="10" fill="${C.accent}" opacity="0.75"/><rect x="26" y="76" width="42" height="42" rx="10" fill="${C.accent}" opacity="0.55"/><rect x="76" y="76" width="42" height="42" rx="10" fill="${C.accent}" opacity="0.35"/>`,
};

/** Command-key icon: the literal command text, sized to fit, purple family. */
function cmdIcon(cmd) {
  const size = Math.max(18, Math.min(30, Math.floor(120 / (cmd.length * 0.6))));
  return (
    `<rect x="18" y="52" width="108" height="44" rx="12" fill="${C.track}"/>` +
    `<text x="72" y="82" font-family="Menlo,monospace" font-size="${size}" font-weight="700" text-anchor="middle" fill="${C.plan}">${cmd}</text>` +
    `<text x="72" y="126" font-family="-apple-system" font-size="20" font-weight="700" text-anchor="middle" fill="${C.dim}">SEND</text>`
  );
}

/** name → { body | glyph, color, contextual?, dial? } */
const ICONS = {
  plugin: { body: shapes.deckLogo },
  category: { body: shapes.deckLogo },
  model: { glyph: ["◈", C.accent] },
  context: { body: shapes.gauge },
  status: { body: shapes.ring },
  name: { body: shapes.terminal },
  mode: { body: shapes.shield },
  session: { body: shapes.clock },
  lines: { glyph: ["±", C.good, 84] },
  cost: { glyph: ["$", C.good, 84] },
  tokens: { glyph: ["#", C.accent, 84] },
  trend: { body: shapes.spark },
  costtrend: { body: shapes.sparkCost },
  planhero: { body: shapes.list },
  planapprove: { glyph: ["✓", C.good], contextual: true },
  planreject: { glyph: ["↻", C.warn], contextual: true },
  planscroll: { body: shapes.list, dial: true },
  dashboard: { body: shapes.grid },
  beacon: { body: shapes.radar },
  effortdial: { body: shapes.speedo, dial: true },
  slot: { body: shapes.slot },
  fleetdial: { body: shapes.fleet, dial: true },
  macro: { glyph: ["⌘", C.plan] },
  cmdcompact: { body: cmdIcon("/compact") },
  cmdclear: { body: cmdIcon("/clear") },
  cmdcontext: { body: cmdIcon("/context") },
  cmdcost: { body: cmdIcon("/cost") },
  cmdresume: { body: cmdIcon("/resume") },
  cmdmodel: { body: cmdIcon("/model") },
  cmdusage: { body: cmdIcon("/AIUse") },
  cmdswitch: { body: cmdIcon("/switch") },
  allow: { glyph: ["✓", C.good], contextual: true },
  alwaysallow: { glyph: ["✓✓", C.info, 56, 88], contextual: true },
  reject: { glyph: ["✕", C.crit], contextual: true },
  interrupt: { body: shapes.stop },
  approve: { glyph: ["⏎", C.good] },
  deny: { glyph: ["✕", C.crit, 70] },
  plan: { glyph: ["⇧", C.plan] },
  slash: { glyph: ["/", C.accent, 84] },
  scroll: { glyph: ["↕", C.warn], dial: true },
};

function svgFor(spec) {
  const parts = [`<rect width="${S}" height="${S}" rx="30" fill="${C.bg}"/>`];
  if (spec.body) parts.push(spec.body);
  if (spec.glyph) parts.push(glyph(...spec.glyph));
  if (spec.contextual) parts.push(contextualBar);
  if (spec.dial) parts.push(dialArc);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${parts.join("")}</svg>`;
}

// --- generate ---
const tmp = join(tmpdir(), "ulanzi-icons-" + process.pid);
mkdirSync(tmp, { recursive: true });
mkdirSync(OUT, { recursive: true });
for (const [name, spec] of Object.entries(ICONS)) {
  writeFileSync(join(tmp, `${name}.svg`), svgFor(spec));
}
execFileSync("qlmanage", ["-t", "-s", String(S), "-o", tmp, ...Object.keys(ICONS).map((n) => join(tmp, `${n}.svg`))], { stdio: "ignore" });
let ok = 0;
for (const name of Object.keys(ICONS)) {
  const png = join(tmp, `${name}.svg.png`);
  const dest = name === "plugin" || name === "category"
    ? join(PLUGIN, "resources", `${name}.png`)
    : join(OUT, `${name}.png`);
  renameSync(png, dest);
  ok++;
}
rmSync(tmp, { recursive: true, force: true });
console.log(`✓ generated ${ok} icons`);

// --- point the manifest at them ---
const mf = join(PLUGIN, "manifest.json");
const m = JSON.parse(readFileSync(mf, "utf8"));
m.Icon = "resources/plugin.png";
m.CategoryIcon = "resources/category.png";
let wired = 0;
for (const a of m.Actions) {
  const key = a.UUID.split(".").pop();
  if (ICONS[key]) {
    a.Icon = `resources/actions/${key}.png`;
    if (a.States?.[0]) a.States[0].Image = `resources/actions/${key}.png`;
    wired++;
  } else {
    console.warn(`! no icon spec for action: ${key}`);
  }
}
writeFileSync(mf, JSON.stringify(m, null, 2) + "\n");
console.log(`✓ manifest wired for ${wired}/${m.Actions.length} actions`);
