// Dev loop: symlink a plugin's repo folder into UlanziDeck's Plugins dir, then
// esbuild-watch its bundle. Editing src/ rebuilds dist/app.js in place; because
// the Plugins entry is a symlink to the repo, UlanziDeck loads the fresh bundle
// on plugin reload — no copy step.
//
//   node tools/dev.mjs [plugin-name]          build + symlink + watch
//   node tools/dev.mjs --link-only [name]     just (re)create the symlink
//   node tools/dev.mjs --unlink [name]        remove the symlink
import { symlink, rm, mkdir, lstat, readlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlugin } from "./build.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const PLUGINS_DIR = join(
  homedir(),
  "Library/Application Support/Ulanzi/UlanziDeck/Plugins"
);

// Folder name convention: any unique dir ending in `.ulanziPlugin` (independent
// of the manifest UUID, matching how installed plugins are laid out).
const DIR_NAME = {
  "claude-deck": "com.ulanzi.ulanzideck.claudedeck.ulanziPlugin",
};

function args() {
  const a = process.argv.slice(2);
  const flags = new Set(a.filter((x) => x.startsWith("--")));
  const name = a.find((x) => !x.startsWith("--")) || "claude-deck";
  return { flags, name };
}

async function link(name) {
  const src = resolve(REPO, "plugins", name);
  const dest = join(PLUGINS_DIR, DIR_NAME[name] || `${name}.ulanziPlugin`);
  if (!existsSync(PLUGINS_DIR)) await mkdir(PLUGINS_DIR, { recursive: true });
  // Replace only if it's already our symlink; refuse to clobber a real dir.
  if (existsSync(dest)) {
    const st = await lstat(dest);
    if (st.isSymbolicLink()) {
      const cur = await readlink(dest);
      if (cur === src) { console.log(`✓ already linked: ${dest}`); return dest; }
      await rm(dest);
    } else {
      throw new Error(`Refusing to overwrite non-symlink at ${dest}. Move it aside first.`);
    }
  }
  await symlink(src, dest, "dir");
  console.log(`🔗 linked ${dest}\n        -> ${src}`);
  return dest;
}

async function unlink(name) {
  const dest = join(PLUGINS_DIR, DIR_NAME[name] || `${name}.ulanziPlugin`);
  if (existsSync(dest)) {
    const st = await lstat(dest);
    if (st.isSymbolicLink()) { await rm(dest); console.log(`unlinked ${dest}`); }
    else console.log(`not a symlink, left alone: ${dest}`);
  }
}

const { flags, name } = args();

if (flags.has("--unlink")) {
  await unlink(name);
} else if (flags.has("--link-only")) {
  await buildPlugin(name);
  await link(name);
} else {
  await link(name);
  console.log("👀 watching src/ … edit and reload the plugin in UlanziDeck to see changes.");
  await buildPlugin(name, {
    watch: true,
    onRebuild: (r) =>
      console.log(
        r?.errors?.length
          ? `✗ rebuild failed (${r.errors.length} errors)`
          : "✓ rebuilt dist/app.js"
      ),
  });
}
