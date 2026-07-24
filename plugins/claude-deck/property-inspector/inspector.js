/* global $UD, Utils */
// Property Inspector for Claude Deck control actions. Shows a keystroke field
// (plus command / scroll fields for the relevant actions) and persists them as
// this button's settings. The deck echoes setSettings back via
// didReceiveSettings, so we track our own last write to avoid clobbering the
// field while the user is typing (pattern borrowed from the claude-usage PI).

let settings = {};
let lastSent = null;

const uuid = Utils.getQueryParams("uuid") || "";
const isSlot = uuid.endsWith(".slot");
const isMacro = uuid.endsWith(".macro") || /\.cmd[a-z]+$/.test(uuid);
const INFO = ["model", "context", "status", "name", "mode", "session", "lines", "planhero", "cost", "tokens", "trend", "costtrend", "dashboard", "beacon"];
const isInfo = INFO.some((s) => uuid.endsWith("." + s));

const el = (id) => document.getElementById(id);
const fields = ["keylist", "command", "keylistUp", "keylistDown", "app", "slot"];

// The "right data" to pre-fill per action, so the inspector is never blank and
// keys work out of the box. Keyed by the action's last UUID segment. These match
// the code defaults in src/app.js.
const key = uuid.split(".").pop();
const DEFAULTS = {
  allow: { keylist: "y" },
  reject: { keylist: "n" },
  planapprove: { keylist: "y" },
  planreject: { keylist: "n" },
  slot: { slot: "1" },
  smartdial: { keylist: "y" },
  cmddial: { command: "/compact,/clear,/context,/cost,/resume,/model,/AIUse,/switch-account", keylist: "⌘V enter" },
  macro: { command: "/compact", keylist: "⌘V enter" },
  cmdcompact: { command: "/compact", keylist: "⌘V enter" },
  cmdclear: { command: "/clear", keylist: "⌘V enter" },
  cmdcontext: { command: "/context", keylist: "⌘V enter" },
  cmdcost: { command: "/cost", keylist: "⌘V enter" },
  cmdresume: { command: "/resume", keylist: "⌘V enter" },
  cmdmodel: { command: "/model", keylist: "⌘V enter" },
  cmdusage: { command: "/AIUse", keylist: "⌘V enter" },
  cmdswitch: { command: "/switch-account", keylist: "⌘V enter" },
}[key] || {};

// Fill any still-empty field with its default, then persist once so the value
// is real (not just displayed). Called after saved settings have loaded.
let defaultsApplied = false;
function applyDefaults() {
  if (defaultsApplied) return;
  defaultsApplied = true;
  let changed = false;
  for (const [f, v] of Object.entries(DEFAULTS)) {
    if (el(f) && !el(f).value) { el(f).value = v; changed = true; }
  }
  if (changed) save();
}

function showRows() {
  if (isSlot) {
    // Slot keys: pick which fleet slot this key shows; no keystroke.
    el("row-slot").classList.remove("hide");
    el("row-app").classList.remove("hide");
    el("row-keylist").classList.add("hide");
    return;
  }
  if (isInfo) {
    // Info tiles: only choose which broker app to read; no keystroke.
    el("row-app").classList.remove("hide");
    el("row-keylist").classList.add("hide");
    return;
  }
  if (isMacro) el("row-command").classList.remove("hide"); // command + calibratable keys
}

function populate(p) {
  if (!p) return;
  settings = { ...settings, ...p };
  for (const f of fields) if (el(f) && p[f] != null) el(f).value = p[f];
}

function collect() {
  const out = {};
  for (const f of fields) if (el(f)) out[f] = el(f).value.trim();
  return out;
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    settings = { ...settings, ...collect() };
    lastSent = JSON.stringify(settings);
    $UD.setSettings(settings);
  }, 250);
}

function readInitial() {
  try {
    const raw = Utils.getQueryParams("param");
    if (raw) populate(JSON.parse(raw));
  } catch (_) {}
}

showRows();
readInitial();

$UD.connect();
$UD.onConnected(() => {
  document.querySelector(".udpi-wrapper")?.classList.remove("hidden");
  $UD.getSettings();
  // If no saved settings arrive shortly (brand-new key), fill the defaults so
  // the inspector is never blank.
  setTimeout(applyDefaults, 400);
});

$UD.onDidReceiveSettings((msg) => {
  const p = msg && (msg.param || msg.settings);
  if (p && typeof p === "object") {
    if (lastSent && JSON.stringify({ ...settings, ...p }) === lastSent) return; // our own echo
    populate(p);
  }
  // Fill any field the saved settings didn't cover.
  applyDefaults();
});

for (const f of fields) el(f)?.addEventListener("input", save);
