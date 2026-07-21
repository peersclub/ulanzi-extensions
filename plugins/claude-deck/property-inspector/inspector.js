/* global $UD, Utils */
// Property Inspector for Claude Deck control actions. Shows a keystroke field
// (plus command / scroll fields for the relevant actions) and persists them as
// this button's settings. The deck echoes setSettings back via
// didReceiveSettings, so we track our own last write to avoid clobbering the
// field while the user is typing (pattern borrowed from the claude-usage PI).

let settings = {};
let lastSent = null;

const uuid = Utils.getQueryParams("uuid") || "";
const isSlash = uuid.endsWith(".slash");
const isScroll = uuid.endsWith(".scroll");
const INFO = ["model", "context", "status", "session", "lines"];
const isInfo = INFO.some((s) => uuid.endsWith("." + s));

const el = (id) => document.getElementById(id);
const fields = ["keylist", "command", "keylistUp", "keylistDown", "app"];

function showRows() {
  if (isInfo) {
    // Info tiles: only choose which broker app to read; no keystroke.
    el("row-app").classList.remove("hide");
    el("row-keylist").classList.add("hide");
    return;
  }
  if (isSlash) el("row-command").classList.remove("hide");
  if (isScroll) {
    el("row-up").classList.remove("hide");
    el("row-down").classList.remove("hide");
    el("row-keylist").classList.add("hide"); // scroll uses up/down, not a single key
  }
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
});

$UD.onDidReceiveSettings((msg) => {
  const p = msg && (msg.param || msg.settings);
  if (!p || typeof p !== "object") return;
  if (lastSent && JSON.stringify({ ...settings, ...p }) === lastSent) return; // our own echo
  populate(p);
});

for (const f of fields) el(f)?.addEventListener("input", save);
