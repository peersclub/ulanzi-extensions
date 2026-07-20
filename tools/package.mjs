#!/usr/bin/env node
// Validate + package a plugin into a distributable zip.
//
//   node tools/package.mjs [plugin-name]
//
// Builds the bundle, sanity-checks the manifest (UUID segment rules, CodePath
// exists), then zips a clean copy (no node_modules/src) as <dir>.ulanziPlugin.zip.
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlugin } from "./build.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const name = process.argv[2] || "claude-deck";
const root = resolve(REPO, "plugins", name);

function fail(msg) { console.error("✗", msg); process.exit(1); }

const manifest = JSON.parse(await fs.readFile(join(root, "manifest.json"), "utf8"));

// --- manifest validation (the footguns from CONVENTIONS.md) ---
if (!manifest.UUID || manifest.UUID.split(".").length !== 4)
  fail(`main UUID must have exactly 4 dot-segments: ${manifest.UUID}`);
for (const a of manifest.Actions || []) {
  if (!a.UUID || a.UUID.split(".").length < 5)
    fail(`action UUID must have 5+ segments: ${a.UUID}`);
  if (!a.UUID.startsWith(manifest.UUID + "."))
    fail(`action UUID must extend the main UUID: ${a.UUID}`);
  for (const c of a.Controllers || ["Keypad"])
    if (!["Keypad", "Encoder"].includes(c)) fail(`bad Controller "${c}" in ${a.UUID}`);
}

await buildPlugin(name);
if (!existsSync(join(root, manifest.CodePath))) fail(`CodePath missing after build: ${manifest.CodePath}`);

const dirName = `${manifest.UUID}.ulanziPlugin`;
const stage = resolve(REPO, "plugins", ".pkg", dirName);
const zip = resolve(REPO, "plugins", `${dirName}.zip`);
await fs.rm(resolve(REPO, "plugins", ".pkg"), { recursive: true, force: true });
await fs.mkdir(dirname(stage), { recursive: true });
// copy everything except dev-only dirs
await fs.cp(root, stage, {
  recursive: true,
  dereference: true,
  filter: (src) => !/\/(node_modules|src|\.pkg)(\/|$)/.test(src),
});
await fs.rm(zip, { force: true });
execFileSync("zip", ["-r", "-q", zip, dirName], { cwd: dirname(stage) });
await fs.rm(resolve(REPO, "plugins", ".pkg"), { recursive: true, force: true });

const { size } = await fs.stat(zip);
console.log(`✓ packaged ${name} -> ${zip} (${(size / 1024).toFixed(0)} KB)`);
console.log("  Install: unzip into UlanziDeck/Plugins/ (or share the .zip).");
