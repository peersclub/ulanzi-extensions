import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import {
  writeState, readState, BROKER_DIR, STALE_MS,
  writeSession, listSessions, currentSession, SESSIONS_DIR,
} from "./index.js";

const APP = "test-app-" + process.pid;
const SAPP = "test-sess-" + process.pid;

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

test("sessions are isolated per id and listed newest-interaction first", async () => {
  await writeSession(SAPP, "s1", { name: "alpha", status: "done" }, { bumpActive: true, now: () => 1000 });
  await writeSession(SAPP, "s2", { name: "beta", status: "thinking" }, { bumpActive: true, now: () => 2000 });
  const list = listSessions(SAPP);
  assert.equal(list.length, 2);
  assert.equal(list[0].name, "beta", "most recently interacted is first");
  assert.equal(list.find((s) => s.sessionId === "s1").name, "alpha");
});

test("a busy but never-interacted session does not steal current", async () => {
  // Fresh ids so the result can't depend on earlier test state.
  // c1: interacted at t=5000. c2: only background writes, LATER (t=6000), no bump.
  await writeSession(SAPP, "c1", { name: "alpha" }, { bumpActive: true, now: () => 5000 });
  await writeSession(SAPP, "c2", { name: "beta", status: "tool" }, { bumpActive: false, now: () => 6000 });
  await writeSession(SAPP, "c2", { name: "beta", status: "tool" }, { bumpActive: false, now: () => 7000 });
  const cur = currentSession(SAPP, { now: () => 7000 });
  assert.equal(cur.name, "alpha", "interacted session wins over a busier, later one");
});

test("interacting with another session switches current to it", async () => {
  await writeSession(SAPP, "c2", { name: "beta" }, { bumpActive: true, now: () => 8000 });
  const cur = currentSession(SAPP, { now: () => 8000 });
  assert.equal(cur.name, "beta", "prompting c2 makes it current");
});

test("currentSession is null when no sessions exist", () => {
  assert.equal(currentSession("no-such-app-" + process.pid), null);
});

test.after(async () => {
  await fs.rm(`${BROKER_DIR}/${APP}.json`, { force: true });
  for (const id of ["s1", "s2", "c1", "c2"]) {
    await fs.rm(`${SESSIONS_DIR}/${SAPP}__${id}.json`, { force: true });
  }
});
