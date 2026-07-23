import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import {
  writeState, readState, BROKER_DIR, STALE_MS,
  writeSession, listSessions, currentSession, SESSIONS_DIR,
  setPin, getPin, clearPin, liveSessions,
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

test("liveSessions orders by startedTs and startedTs never moves", async () => {
  await writeSession(SAPP, "f2", { name: "second" }, { now: () => 2000 });
  await writeSession(SAPP, "f1", { name: "first" }, { now: () => 1000 });
  await writeSession(SAPP, "f1", { name: "first-again" }, { now: () => 9000 }); // later write
  const now = () => 10000;
  const live = liveSessions(SAPP, { now }).filter((s) => s.sessionId.startsWith("f"));
  assert.deepEqual(live.map((s) => s.sessionId), ["f1", "f2"], "slot order = first-write order");
  assert.equal(live[0].startedTs, 1000, "startedTs unchanged by later writes");
});

test("pin overrides interaction; unpin restores; dead pin ignored", async () => {
  // c2 was last interacted (from earlier test) — pin f1 and it must win.
  await setPin(SAPP, "f1");
  assert.equal(currentSession(SAPP, { now: () => 10000 }).sessionId, "f1");
  assert.equal(currentSession(SAPP, { now: () => 10000 }).pinned, true);
  await clearPin(SAPP);
  assert.notEqual(currentSession(SAPP, { now: () => 10000 }).sessionId, "f1", "unpinned -> interaction order");
  // pin something that then goes stale: fall back gracefully
  await setPin(SAPP, "f2");
  const much_later = () => 10000 + 10 * 60 * 1000; // beyond SESSION_LIVE_MS
  assert.equal(currentSession(SAPP, { now: much_later }).pinned, false, "dead pin ignored");
  await clearPin(SAPP);
  assert.equal(getPin(SAPP), null);
});

test("unread rule: finishedTs beats viewedTs/activeTs only when newer", async () => {
  const unread = (s) => (s.finishedTs || 0) > Math.max(s.viewedTs || 0, s.activeTs || 0);
  await writeSession(SAPP, "u1", { finishedTs: 5000 }, { now: () => 5000 });
  let s = listSessions(SAPP).find((x) => x.sessionId === "u1");
  assert.equal(unread(s), true, "finished, never viewed -> unread");
  await writeSession(SAPP, "u1", { viewedTs: 6000 }, { now: () => 6000 });
  s = listSessions(SAPP).find((x) => x.sessionId === "u1");
  assert.equal(unread(s), false, "viewed after finish -> read");
  await writeSession(SAPP, "u1", { finishedTs: 7000 }, { now: () => 7000 });
  s = listSessions(SAPP).find((x) => x.sessionId === "u1");
  assert.equal(unread(s), true, "finished again after viewing -> unread again");
});

test.after(async () => {
  await fs.rm(`${BROKER_DIR}/${APP}.json`, { force: true });
  for (const id of ["s1", "s2", "c1", "c2", "f1", "f2", "u1"]) {
    await fs.rm(`${SESSIONS_DIR}/${SAPP}__${id}.json`, { force: true });
  }
  await clearPin(SAPP);
});
