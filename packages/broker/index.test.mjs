import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { writeState, readState, BROKER_DIR, STALE_MS } from "./index.js";

const APP = "test-app-" + process.pid;

test("writeState merges patches and stamps ts", async () => {
  let clock = 1000;
  await writeState(APP, { model: "sonnet", contextPct: 10 }, () => clock);
  clock = 2000;
  await writeState(APP, { contextPct: 42 }, () => clock);
  const s = readState(APP, () => 2000);
  assert.equal(s.model, "sonnet", "earlier field preserved across merge");
  assert.equal(s.contextPct, 42, "later field overrides");
  assert.equal(s.ts, 2000);
  assert.equal(s.app, APP);
});

test("readState flags staleness past STALE_MS", async () => {
  await writeState(APP, { model: "opus" }, () => 0);
  const fresh = readState(APP, () => STALE_MS - 1);
  const stale = readState(APP, () => STALE_MS + 1);
  assert.equal(fresh.stale, false);
  assert.equal(stale.stale, true);
});

test("readState returns null for unknown app", () => {
  assert.equal(readState("does-not-exist-" + process.pid), null);
});

test.after(async () => {
  await fs.rm(`${BROKER_DIR}/${APP}.json`, { force: true });
});
