// @ts-check
/**
 * Minimal pure-JS animated GIF89a encoder + prebuilt key-face animations.
 *
 * Why: the deck natively animates GIFs via setGifDataIcon — smoother than our
 * ~6fps SVG re-push, and zero runtime traffic once sent. SVG can't be used for
 * this (GIF needs bitmaps), so frames are drawn with plain pixel math.
 *
 * Encoding note: we emit "uncompressed" LZW — literal codes with a CLEAR every
 * 2^codeSize-2-tableSize symbols so the code width never grows. Larger output
 * than real LZW but provably correct with no dictionary edge cases.
 */

const B = (...a) => Buffer.from(a.flat());

function u16(n) {
  return [n & 0xff, (n >> 8) & 0xff];
}

/**
 * Encode an animated GIF.
 * @param {number} w @param {number} h
 * @param {number[][]} frames each frame = w*h palette indices
 * @param {Array<[number,number,number]>} palette up to 16 [r,g,b] entries
 * @param {number} delayCs per-frame delay in centiseconds
 * @returns {Buffer}
 */
export function encodeGif(w, h, frames, palette, delayCs = 8) {
  const bits = 4; // 16-color table
  const pal = Buffer.alloc(3 * 16);
  palette.slice(0, 16).forEach(([r, g, b], i) => { pal[i * 3] = r; pal[i * 3 + 1] = g; pal[i * 3 + 2] = b; });

  const parts = [
    Buffer.from("GIF89a", "ascii"),
    B(u16(w), u16(h), 0xf0 | (bits - 1), 0, 0), // LSD + GCT flag
    pal,
    B(0x21, 0xff, 0x0b), Buffer.from("NETSCAPE2.0", "ascii"), B(3, 1, 0, 0, 0), // loop forever
  ];

  const minCode = 4;
  const CLEAR = 1 << minCode; // 16
  const EOI = CLEAR + 1;      // 17
  const codeSize = minCode + 1; // stays 5 bits (uncompressed technique)
  const MAX_RUN = (1 << codeSize) - 2 - CLEAR; // literals per clear so width never grows

  for (const px of frames) {
    parts.push(B(0x21, 0xf9, 0x04, 0x04, u16(delayCs), 0, 0)); // GCE: no transparency
    parts.push(B(0x2c, u16(0), u16(0), u16(w), u16(h), 0));    // image descriptor
    // bit-pack codes LSB-first
    const bytes = [];
    let acc = 0, nbits = 0;
    const emit = (code) => {
      acc |= code << nbits;
      nbits += codeSize;
      while (nbits >= 8) { bytes.push(acc & 0xff); acc >>= 8; nbits -= 8; }
    };
    emit(CLEAR);
    let run = 0;
    for (const idx of px) {
      emit(idx & 0x0f);
      if (++run >= MAX_RUN) { emit(CLEAR); run = 0; }
    }
    emit(EOI);
    if (nbits > 0) bytes.push(acc & 0xff);
    // sub-blocks
    const sub = [minCode];
    for (let i = 0; i < bytes.length; i += 255) {
      const chunk = bytes.slice(i, i + 255);
      sub.push(chunk.length, ...chunk);
    }
    sub.push(0);
    parts.push(Buffer.from(sub));
  }
  parts.push(B(0x3b)); // trailer
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// Prebuilt faces
// ---------------------------------------------------------------------------

const hex = (s) => /** @type {[number,number,number]} */ ([1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)));

/** bg + 6 tail shades of a color + full color. */
function shades(color, bg = "#1f1f23") {
  const [r, g, b] = hex(color);
  const [br, bgc, bb] = hex(bg);
  const out = [[br, bgc, bb]];
  for (let i = 0; i < 7; i++) {
    const f = (i + 1) / 7;
    out.push([Math.round(br + (r - br) * f), Math.round(bgc + (g - bgc) * f), Math.round(bb + (b - bb) * f)]);
  }
  return out;
}

/**
 * Rotating spinner with a fading tail (like the SVG one, but buttery).
 * @param {string} color hex "#rrggbb"
 */
export function spinnerGif(color, size = 96, frames = 12) {
  const pal = shades(color);
  const c = size / 2;
  const rIn = size * 0.3, rOut = size * 0.44;
  const out = [];
  for (let f = 0; f < frames; f++) {
    const head = (f / frames) * Math.PI * 2;
    const px = new Array(size * size).fill(0);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - c, dy = y - c;
        const r = Math.hypot(dx, dy);
        if (r < rIn || r > rOut) continue;
        let d = head - Math.atan2(dy, dx);
        d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (d < 1.6) px[y * size + x] = 7 - Math.min(6, Math.floor((d / 1.6) * 7));
      }
    }
    out.push(px);
  }
  return encodeGif(size, size, out, pal, 7);
}

/**
 * Breathing pulse — a disc that swells and fades. For "needs your attention".
 * @param {string} color hex "#rrggbb"
 */
export function pulseGif(color, size = 96, frames = 10) {
  const pal = shades(color);
  const c = size / 2;
  const out = [];
  for (let f = 0; f < frames; f++) {
    const phase = Math.sin((f / frames) * Math.PI); // 0→1→0
    const radius = size * (0.18 + 0.26 * phase);
    const shade = 2 + Math.round(5 * phase);
    const px = new Array(size * size).fill(0);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (Math.hypot(x - c, y - c) <= radius) px[y * size + x] = shade;
      }
    }
    out.push(px);
  }
  return encodeGif(size, size, out, pal, 9);
}

/** As a data URI for setGifDataIcon. */
export const gifDataUrl = (/** @type {Buffer} */ buf) => `data:image/gif;base64,${buf.toString("base64")}`;
