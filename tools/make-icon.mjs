// Generate a solid-color rounded PNG icon for manifest metadata slots.
// Pure Node (zlib) — no native deps, no randomness. Usage:
//   node tools/make-icon.mjs <out.png> [size] [#rrggbb]
import zlib from "node:zlib";
import { writeFileSync } from "node:fs";

const [out, sizeArg, colorArg] = process.argv.slice(2);
const size = Number(sizeArg) || 72;
const hex = (colorArg || "#d77757").replace("#", "");
const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const row = Buffer.alloc(1 + size * 4);
for (let x = 0; x < size; x++) {
  const o = 1 + x * 4;
  row[o] = r; row[o + 1] = g; row[o + 2] = b; row[o + 3] = 255;
}
const raw = Buffer.concat(Array.from({ length: size }, () => row));
const idat = zlib.deflateSync(raw);

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(out, png);
console.log("wrote", out, `${size}x${size}`);
