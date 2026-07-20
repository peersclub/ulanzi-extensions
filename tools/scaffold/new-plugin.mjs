#!/usr/bin/env node
// Scaffold a new UlanziDeck plugin on the ulanzi-lab foundation.
//
//   node tools/scaffold/new-plugin.mjs <kebab-name> [slug]
//
// Produces plugins/<name>/ with a manifest, a runtime-based app.js, a Property
// Inspector, generated icons, and workspace-linked deps — ready for `pnpm dev`.
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("usage: new-plugin <kebab-name> [slug]   (lowercase, dashes)");
  process.exit(1);
}
const slug = (process.argv[3] || name.replace(/-/g, "")).toLowerCase();
const UUID = `com.ulanzi.ulanzideck.${slug}`;
const root = resolve(REPO, "plugins", name);
if (existsSync(root)) {
  console.error(`plugins/${name} already exists`);
  process.exit(1);
}

await fs.mkdir(join(root, "src"), { recursive: true });
await fs.mkdir(join(root, "property-inspector"), { recursive: true });
await fs.mkdir(join(root, "resources"), { recursive: true });
await fs.mkdir(join(root, "libs"), { recursive: true });

// icons
const icon = resolve(HERE, "..", "make-icon.mjs");
for (const [file, color] of [["plugin", "#d77757"], ["category", "#1f1f23"], ["action", "#58a6ff"]]) {
  execFileSync(process.execPath, [icon, join(root, "resources", `${file}.png`), "72", color]);
}
// share the browser SDK libs for the PI
await fs.cp(resolve(REPO, "plugins/claude-deck/libs"), join(root, "libs"), { recursive: true });

await fs.writeFile(join(root, "manifest.json"), JSON.stringify({
  UUID, Name: name, Description: `${name} plugin`, Author: "ulanzi-lab", Version: "0.1.0",
  Icon: "resources/plugin.png", Category: name, CategoryIcon: "resources/category.png",
  CodePath: "dist/app.js", Type: "JavaScript", PrivateAPI: true, SupportedInMultiActions: false,
  OS: [{ Platform: "mac", MinimumVersion: "12.0" }], Software: { MinimumVersion: "3.0.11" },
  Actions: [{
    Name: "Hello", Tooltip: "Example action", Icon: "resources/action.png",
    PropertyInspectorPath: "property-inspector/inspector.html",
    UUID: `${UUID}.hello`, States: [{ Image: "resources/action.png" }], Controllers: ["Keypad"],
  }],
}, null, 2));

await fs.writeFile(join(root, "package.json"), JSON.stringify({
  name: `@ulanzi-lab/${name}`, version: "0.1.0", private: true, type: "module",
  dependencies: {
    "@ulanzi-lab/broker": "workspace:*", "@ulanzi-lab/runtime": "workspace:*",
    "@ulanzi-lab/sdk": "workspace:*", "@ulanzi-lab/tiles": "workspace:*",
  },
}, null, 2));

await fs.writeFile(join(root, "src/app.js"), `// @ts-check
import { definePlugin, defineAction } from "@ulanzi-lab/runtime";
import { KpiTile } from "@ulanzi-lab/tiles";

const P = "${UUID}";

const Hello = defineAction({
  uuid: \`\${P}.hello\`,
  active(b) {
    b.state.n = 0;
    b.setIcon(KpiTile({ title: "${name}", value: "hi" }));
  },
  run(b) {
    b.state.n = (b.state.n || 0) + 1;
    b.setIcon(KpiTile({ title: "Taps", value: b.state.n }));
  },
});

definePlugin({ uuid: P, actions: [Hello] }).start();
`);

await fs.writeFile(join(root, "property-inspector/inspector.html"), `<!DOCTYPE html>
<html><head><meta charset="UTF-8" />
<link rel="stylesheet" href="../libs/css/uspi.css" /></head>
<body><div class="udpi-wrapper hidden uspi-wrapper"><div style="padding:12px">No settings.</div></div>
<script src="../libs/js/constants.js"></script>
<script src="../libs/js/eventEmitter.js"></script>
<script src="../libs/js/timers.js"></script>
<script src="../libs/js/utils.js"></script>
<script src="../libs/js/ulanziApi.js"></script>
<script>$UD.connect();$UD.onConnected(()=>document.querySelector('.udpi-wrapper').classList.remove('hidden'));</script>
</body></html>
`);

// register a dir-name mapping hint for tools/dev.mjs
console.log(`
✓ created plugins/${name}  (UUID ${UUID})

Next:
  1. pnpm install                       # link workspace deps
  2. add to tools/dev.mjs DIR_NAME:     "${name}": "${UUID}.ulanziPlugin"
  3. node tools/dev.mjs ${name}         # build + symlink + watch
  4. In UlanziDeck, add the "Hello" action to a key.
`);
