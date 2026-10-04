/**
 * Shared software rasteriser for HelioTyper's sprite generators.
 *
 * Zero dependencies. Everything is drawn at SS× and box-averaged down, which is
 * where the clean antialiased edges come from, then encoded to PNG by hand over
 * node:zlib. Generators import from here and only supply the art.
 *
 * All drawing is deterministic — same input, byte-identical PNG every run.
 */

import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

export const SS = 3; // supersample factor

/* ------------------------------------------------------------------ *
 * PRNG + value noise (deterministic, so regenerating is reproducible)
 * ------------------------------------------------------------------ */

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stable seed offset hashed from a string key. Use this instead of hardcoding
 * per-subject offsets — hardcoded ones collide the moment you add a third
 * subject, and everything after it renders with identical randomness.
 */
export function seedOf(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}

export function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const table = Array.from({ length: 256 }, () => rnd() * 2 - 1);
  return (x) => {
    const i = Math.floor(x), f = x - i;
    const a = table[((i % 256) + 256) % 256];
    const b = table[(((i + 1) % 256) + 256) % 256];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
}

export const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const lerp = (a, b, t) => a + (b - a) * t;
export const mixColor = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/* ------------------------------------------------------------------ *
 * Layer — premultiplied float RGBA. Premultiplied makes additive
 * blending and blurring correct without special cases.
 * ------------------------------------------------------------------ */

export class Layer {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.d = new Float32Array(w * h * 4);
  }
  over(x, y, [r, g, b], a) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.d, ia = 1 - a;
    d[i] = r * a + d[i] * ia;
    d[i + 1] = g * a + d[i + 1] * ia;
    d[i + 2] = b * a + d[i + 2] * ia;
    d[i + 3] = a + d[i + 3] * ia;
  }
  add(x, y, [r, g, b], a) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.d;
    d[i] += r * a; d[i + 1] += g * a; d[i + 2] += b * a;
    d[i + 3] = Math.min(1, d[i + 3] + a);
  }
  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y * this.w + x) * 4 + 3];
  }
  clone() {
    const l = new Layer(this.w, this.h);
    l.d.set(this.d);
    return l;
  }
  /** Composite another same-size layer on top of this one, source-over. */
  drawLayer(src, k = 1) {
    const d = this.d, s = src.d;
    for (let i = 0; i < d.length; i += 4) {
      const a = s[i + 3] * k;
      if (a <= 0) continue;
      const ia = 1 - a;
      d[i] = s[i] * k + d[i] * ia;
      d[i + 1] = s[i + 1] * k + d[i + 1] * ia;
      d[i + 2] = s[i + 2] * k + d[i + 2] * ia;
      d[i + 3] = a + d[i + 3] * ia;
    }
  }
  /** Additively accumulate another same-size layer (used for glow passes). */
  addLayer(src, k = 1) {
    const d = this.d, s = src.d;
    for (let i = 0; i < d.length; i += 4) {
      if (s[i + 3] <= 0) continue;
      d[i] += s[i] * k; d[i + 1] += s[i + 1] * k; d[i + 2] += s[i + 2] * k;
      d[i + 3] = Math.min(1, d[i + 3] + s[i + 3] * k);
    }
  }
  /** Multiply RGB in place, alpha untouched — for baking form shading. */
  shade(fn) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        if (this.d[i + 3] <= 0) continue;
        const k = fn(x, y);
        this.d[i] *= k; this.d[i + 1] *= k; this.d[i + 2] *= k;
      }
  }
  blit(src, ox, oy) {
    for (let y = 0; y < src.h; y++) {
      const ty = oy + y;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const tx = ox + x;
        if (tx < 0 || tx >= this.w) continue;
        const si = (y * src.w + x) * 4, di = (ty * this.w + tx) * 4;
        this.d[di] = src.d[si]; this.d[di + 1] = src.d[si + 1];
        this.d[di + 2] = src.d[si + 2]; this.d[di + 3] = src.d[si + 3];
      }
    }
  }
}

/** Separable box blur, run twice to approximate a gaussian. */
export function blur(layer, radius) {
  let cur = layer;
  for (let pass = 0; pass < 2; pass++) {
    cur = boxPass(boxPass(cur, radius, true), radius, false);
  }
  return cur;
}

function boxPass(src, r, horizontal) {
  const { w, h } = src;
  const out = new Layer(w, h);
  const n = r * 2 + 1;
  for (let a = 0; a < (horizontal ? h : w); a++) {
    for (let b = 0; b < (horizontal ? w : h); b++) {
      let sr = 0, sg = 0, sb = 0, sa = 0;
      for (let k = -r; k <= r; k++) {
        const bb = Math.min((horizontal ? w : h) - 1, Math.max(0, b + k));
        const i = horizontal ? (a * w + bb) * 4 : (bb * w + a) * 4;
        sr += src.d[i]; sg += src.d[i + 1]; sb += src.d[i + 2]; sa += src.d[i + 3];
      }
      const o = horizontal ? (a * w + b) * 4 : (b * w + a) * 4;
      out.d[o] = sr / n; out.d[o + 1] = sg / n; out.d[o + 2] = sb / n;
      out.d[o + 3] = sa / n;
    }
  }
  return out;
}

/** Square dilation of the alpha channel (max filter), for outlines. */
export function dilateAlpha(src, r) {
  const { w, h } = src;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        m = Math.max(m, src.d[(y * w + xx) * 4 + 3]);
      }
      tmp[y * w + x] = m;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        m = Math.max(m, tmp[yy * w + x]);
      }
      out[y * w + x] = m;
    }
  return out;
}

/* ------------------------------------------------------------------ *
 * Ctx — draws in sprite units into a supersampled Layer
 * ------------------------------------------------------------------ */

export const hex = (s) => [
  parseInt(s.slice(1, 3), 16) / 255,
  parseInt(s.slice(3, 5), 16) / 255,
  parseInt(s.slice(5, 7), 16) / 255,
];

export class Ctx {
  constructor(layer, anchorX, anchorY) {
    this.L = layer;
    this.ox = anchorX * SS;
    this.oy = anchorY * SS;
  }
  X(x) { return this.ox + x * SS; }
  Y(y) { return this.oy + y * SS; }

  poly(pts, color, alpha = 1, mode = 'over') {
    const dev = pts.map(([x, y]) => [this.X(x), this.Y(y)]);
    fillPolygon(this.L, dev, color, alpha, mode);
  }
  rect(x, y, w, h, color, alpha = 1, mode = 'over') {
    this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], color, alpha, mode);
  }
  disc(cx, cy, r, color, alpha = 1, mode = 'over') {
    this.ellipse(cx, cy, r, r, color, alpha, mode);
  }
  ellipse(cx, cy, rx, ry, color, alpha = 1, mode = 'over') {
    const pts = [];
    const steps = Math.max(12, Math.ceil(Math.max(rx, ry) * 2.5));
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
    }
    this.poly(pts, color, alpha, mode);
  }
  /** Radial falloff blob — the workhorse for glow and smoke. */
  softDisc(cx, cy, r, color, alpha = 1, falloff = 2, mode = 'add') {
    const L = this.L;
    const dcx = this.X(cx), dcy = this.Y(cy), dr = r * SS;
    const x0 = Math.max(0, Math.floor(dcx - dr)), x1 = Math.min(L.w - 1, Math.ceil(dcx + dr));
    const y0 = Math.max(0, Math.floor(dcy - dr)), y1 = Math.min(L.h - 1, Math.ceil(dcy + dr));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - dcx, y + 0.5 - dcy) / dr;
        if (d >= 1) continue;
        const a = alpha * Math.pow(1 - d, falloff);
        if (mode === 'add') L.add(x, y, color, a); else L.over(x, y, color, a);
      }
    }
  }
  thickLine(pts, width, color, alpha = 1, mode = 'over') {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * width / 2, ny = (dx / len) * width / 2;
      this.poly([
        [x1 + nx, y1 + ny], [x2 + nx, y2 + ny],
        [x2 - nx, y2 - ny], [x1 - nx, y1 - ny],
      ], color, alpha, mode);
    }
    // round off the joints so the polyline reads as one stroke
    for (const [x, y] of pts) this.disc(x, y, width / 2, color, alpha, mode);
  }
}

/** Scanline polygon fill in device space. Supersampling supplies the AA. */
export function fillPolygon(L, pts, color, alpha, mode) {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(L.h - 1, Math.ceil(maxY));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > sy) !== (yj > sy)) xs.push(xi + ((sy - yi) / (yj - yi)) * (xj - xi));
    }
    if (!xs.length) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const sx = Math.max(0, Math.ceil(xs[k] - 0.5));
      const ex = Math.min(L.w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = sx; x <= ex; x++) {
        if (mode === 'add') L.add(x, y, color, alpha); else L.over(x, y, color, alpha);
      }
    }
  }
}

/**
 * Build a closed polygon from a half-width profile, optionally clipped to a
 * horizontal slice of it. `from`/`to` are fractions of the half width, so
 * (-1, 1) is the full shape and (-1, -0.3) is just the left highlight strip.
 */
export function profilePoly(hw, yTop, yBot, from = -1, to = 1, steps = 48) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const y = yTop + ((yBot - yTop) * i) / steps;
    pts.push([hw(y) * from, y]);
  }
  for (let i = steps; i >= 0; i--) {
    const y = yTop + ((yBot - yTop) * i) / steps;
    pts.push([hw(y) * to, y]);
  }
  return pts;
}

/**
 * Half-width profile from piecewise-linear [y, halfWidth] keypoints. Straight
 * segments stay straight through profilePoly's sampling, which is what keeps a
 * faceted shape faceted instead of rounding it off like a sqrt profile does.
 */
export function lerpProfile(keys) {
  return (y) => {
    if (y <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [y0, w0] = keys[i - 1], [y1, w1] = keys[i];
      if (y <= y1) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
    }
    return keys[keys.length - 1][1];
  };
}

/* ------------------------------------------------------------------ *
 * Cells and packing
 * ------------------------------------------------------------------ */

/** A fresh supersampled cell plus a Ctx anchored per the spec. */
export function newCell(spec) {
  const L = new Layer(spec.w * SS, spec.h * SS);
  return { L, c: new Ctx(L, spec.ax, spec.ay), spec };
}

/** Average SS×SS blocks down to the final resolution. */
export function downsample(src, spec) {
  const out = new Layer(spec.w, spec.h);
  const n = SS * SS;
  for (let y = 0; y < spec.h; y++) {
    for (let x = 0; x < spec.w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * src.w + (x * SS + sx)) * 4;
          r += src.d[i]; g += src.d[i + 1]; b += src.d[i + 2]; a += src.d[i + 3];
        }
      }
      const o = (y * spec.w + x) * 4;
      out.d[o] = r / n; out.d[o + 1] = g / n; out.d[o + 2] = b / n; out.d[o + 3] = a / n;
    }
  }
  return out;
}

/**
 * Pack uniform-cell sections stacked vertically. Each section is
 * `{ cols, spec, cells: [{ name, layer }] }` where `layer` is supersampled;
 * it gets downsampled on the way in. Sheet width is the widest section.
 *
 * Sections keep their own cell size, so big frames (a wide exhaust cloud) can
 * live on the same sheet as small ones without padding everything to the max.
 */
export function packSections(sections) {
  const sheetW = Math.max(...sections.map((s) => s.cols * s.spec.w));
  let sheetH = 0;
  for (const s of sections) sheetH += Math.ceil(s.cells.length / s.cols) * s.spec.h;

  const sheet = new Layer(sheetW, sheetH);
  const frames = {};
  let yOff = 0;

  for (const s of sections) {
    s.cells.forEach((cell, i) => {
      const x = (i % s.cols) * s.spec.w;
      const y = yOff + Math.floor(i / s.cols) * s.spec.h;
      sheet.blit(downsample(cell.layer, s.spec), x, y);
      frames[cell.name] = { x, y, w: s.spec.w, h: s.spec.h, ax: s.spec.ax, ay: s.spec.ay };
    });
    yOff += Math.ceil(s.cells.length / s.cols) * s.spec.h;
  }

  return { sheet, frames, size: { w: sheetW, h: sheetH } };
}

/* ------------------------------------------------------------------ *
 * PNG encode
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePNG(layer) {
  const { w, h, d } = layer;
  // one filter byte (0 = None) per scanline, then straight (un-premultiplied) RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = Math.min(1, d[i + 3]);
      if (a <= 0) { p += 4; continue; }
      raw[p++] = Math.round(Math.min(1, d[i] / a) * 255);
      raw[p++] = Math.round(Math.min(1, d[i + 1] / a) * 255);
      raw[p++] = Math.round(Math.min(1, d[i + 2] / a) * 255);
      raw[p++] = Math.round(a * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Write `<name>.png` + `<name>.json`, and return the PNG byte length. */
export function writeSheet(dir, name, sheet, atlas) {
  const png = encodePNG(sheet);
  fs.writeFileSync(path.join(dir, `${name}.png`), png);
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(atlas, null, 2));
  return png.length;
}

/**
 * Mirror atlases into a plain JS global so previews can load them straight off
 * the filesystem — fetch() is blocked under file://.
 */
export function writeAtlasGlobal(dir, file, globals, by = '') {
  const body = Object.entries(globals)
    .map(([k, v]) => `window.${k} = ${JSON.stringify(v, null, 2)};`)
    .join('\n');
  const head = by ? `// Generated by ${by}. Do not edit by hand.` : '// Generated. Do not edit by hand.';
  fs.writeFileSync(path.join(dir, file), `${head}\n${body}\n`);
}
