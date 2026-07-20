// Bundle a plugin's src/app.js into a single dist/app.js the UlanziDeck runtime
// can execute standalone (no node_modules to ship).
//
// Why bundle: our plugin imports workspace packages (@ulanzi-lab/*) by bare
// specifier. The runtime copies/loads the plugin folder in isolation, so those
// specifiers must be inlined. esbuild resolves the whole graph — including `ws`
// (pure JS) — into one file. ws's optional native accelerators are marked
// external; ws already try/catches their absence at runtime.
import { build } from "esbuild";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");

export async function buildPlugin(name, { watch = false, onRebuild } = {}) {
  const root = resolve(REPO, "plugins", name);
  const ctx = {
    entryPoints: [resolve(root, "src/app.js")],
    outfile: resolve(root, "dist/app.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    // ws optional speedups — absent is fine (ws falls back to pure JS).
    external: ["bufferutil", "utf-8-validate"],
    // ESM output needs a `require` for any dep that still calls it (ws internals).
    banner: {
      js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
    },
    logLevel: "info",
    plugins: watch
      ? [{
          name: "notify",
          setup(b) {
            b.onEnd((r) => onRebuild?.(r));
          },
        }]
      : [],
  };

  if (!watch) {
    await build(ctx);
    return;
  }
  const { context } = await import("esbuild");
  const c = await context(ctx);
  await c.watch();
  return c;
}

// CLI: node tools/build.mjs <plugin-name>
if (import.meta.url === `file://${process.argv[1]}`) {
  const name = process.argv[2] || "claude-deck";
  await buildPlugin(name);
  console.log(`built ${name} -> plugins/${name}/dist/app.js`);
}
