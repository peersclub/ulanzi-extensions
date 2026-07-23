import { test } from "node:test";
import assert from "node:assert/strict";
import { KpiTile, StatusDot, GaugeTile, SparkTile, ActionTile, NameTile, ModeTile, PlanHeroTile, PlanStepTile } from "./index.js";

function decode(dataUrl) {
  const m = /^data:image\/svg\+xml;base64,(.+)$/.exec(dataUrl);
  assert.ok(m, "must be an svg data URI");
  return Buffer.from(m[1], "base64").toString("utf8");
}

test("KpiTile embeds title and value, well-formed svg", () => {
  const svg = decode(KpiTile({ title: "Model", value: "sonnet", sub: "62% ctx" }));
  assert.match(svg, /<svg[^>]*viewBox="0 0 200 200"/);
  assert.match(svg, /sonnet/);
  assert.match(svg, /MODEL/);
  assert.equal((svg.match(/<svg/g) || []).length, 1);
});

test("GaugeTile clamps out-of-range pct", () => {
  assert.match(decode(GaugeTile({ label: "ctx", pct: 130 })), /100%/);
  assert.match(decode(GaugeTile({ label: "ctx", pct: -5 })), /0%/);
});

test("StatusDot renders known + unknown status safely", () => {
  assert.match(decode(StatusDot({ status: "thinking" })), /thinking/);
  assert.doesNotThrow(() => StatusDot({ status: "bogus" }));
});

test("SparkTile handles empty and single-point series", () => {
  assert.doesNotThrow(() => SparkTile({ label: "tok", values: [] }));
  assert.doesNotThrow(() => SparkTile({ label: "tok", values: [5] }));
});

test("all tile text is xml-escaped (no raw angle brackets in content)", () => {
  // KpiTile value is not case-transformed, so we can assert exact escaping.
  const svg = decode(KpiTile({ title: "t", value: "a & b <c>" }));
  assert.match(svg, /a &amp; b &lt;c&gt;/);
  assert.doesNotMatch(svg, /<c>/); // raw injection must not survive
});

test("KpiTile shrinks long values so they fit the key (no overflow-clipping)", () => {
  const fontOf = (svg) => [...svg.matchAll(/font-size="(\d+)"[^>]*font-weight="800"/g)].map((m) => +m[1])[0];
  for (const v of ["Opus 4.8", "claude-fable-5", "+7088", "1.2M"]) {
    const size = fontOf(decode(KpiTile({ title: "M", value: v })));
    const estWidth = v.length * 0.62 * size;
    assert.ok(estWidth <= 176, `"${v}" estimated ${estWidth.toFixed(0)}px exceeds key width`);
  }
  // A short value should still be large.
  assert.ok(fontOf(decode(KpiTile({ title: "M", value: "3" }))) >= 50);
});

test("PlanHeroTile shows step count; PlanStepTile shows position", () => {
  assert.match(decode(PlanHeroTile({ steps: ["a", "b", "c"] })), /PLAN READY/);
  assert.match(decode(PlanHeroTile({ steps: ["a", "b", "c"] })), />3</);
  assert.match(decode(PlanStepTile({ index: 1, total: 4, text: "second step" })), /STEP 2\/4/);
});

test("NameTile truncates long names and renders", () => {
  const svg = decode(NameTile({ name: "a-very-long-project-name", sub: "2 live" }));
  assert.match(svg, /…/);
  assert.match(svg, /SESSION/);
});

// Regression guard for the on-device render bug: Ulanzi Studio uses Qt's QSvg
// (SVG Tiny 1.2), which does NOT support 8-digit hex colors (#RRGGBBAA). A tile
// containing one renders blank on the deck. Every tile must avoid them.
test("no tile emits an 8-digit hex color (QSvg incompatible)", () => {
  const tiles = [
    KpiTile({ title: "M", value: "x", sub: "y" }),
    GaugeTile({ label: "c", pct: 50 }),
    StatusDot({ status: "thinking", sub: "s" }),
    SparkTile({ label: "t", values: [1, 2, 3], value: 3 }),
    ActionTile({ glyph: "X", caption: "go" }),
    NameTile({ name: "proj", sub: "1 live" }),
    ModeTile({ mode: "acceptEdits" }),
    PlanHeroTile({ steps: ["a", "b", "c"] }),
    PlanStepTile({ index: 0, total: 3, text: "do the first thing carefully" }),
  ].map(decode);
  for (const svg of tiles) {
    assert.equal(/#[0-9a-fA-F]{8}\b/.test(svg), false, "8-digit hex found: " + svg.slice(0, 80));
  }
});
