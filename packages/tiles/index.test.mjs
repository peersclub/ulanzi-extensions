import { test } from "node:test";
import assert from "node:assert/strict";
import { KpiTile, StatusDot, GaugeTile, SparkTile, ActionTile } from "./index.js";

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
