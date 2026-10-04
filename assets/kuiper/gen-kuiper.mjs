/**
 * HelioTyper Kuiper belt generator: the icy bodies past Neptune.
 *
 * Run with:  node assets/kuiper/gen-kuiper.mjs
 *
 * The belt is a field, not a landmark. The game scatters these through the
 * stretch of the run past Neptune, dozens on screen at once at different
 * depths, so where every planet is one unique body, this is a small kit of
 * rocks that reads as many once each copy is turned, sized and placed apart.
 *
 * Two are real objects, for anyone who knows the belt: Arrokoth, the red
 * two-lobed snowman New Horizons flew past in 2019, and Haumea, spun into an
 * egg by a day less than four hours long.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SS, mulberry32, seedOf, Layer, hex, Ctx, newCell, packSections, writeSheet, writeAtlasGlobal,
} from '../lib/raster.mjs';

const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WHITE = [1, 1, 1];

// cell specs: rocks big enough to pick out up close, and pebbles for the far field
const ROCK = { w: 128, h: 128, ax: 64, ay: 64 };
const PEBBLE = { w: 40, h: 40, ax: 20, ay: 20 };

/* ------------------------------------------------------------------ *
 * Shapes and shading
 * ------------------------------------------------------------------ */

/**
 * A lumpy outline: a circle whose radius wanders with a few low harmonics, so
 * every rock is its own potato rather than one more disc. `squash` flattens it
 * vertically, and the whole shape is scaled down if a lump would reach past
 * `fit`, the room it has in its cell.
 *
 * Returns the radius as a function of angle along with the polygon, because the
 * shading has to know where this shape's limb is, and a lumpy rock's limb is not
 * at any one radius.
 */
function lumpy(rnd, R, { lumps = 1, squash = 1, cx = 0, cy = 0, fit = Infinity } = {}) {
  const waves = [[2, 0.16], [3, 0.08], [4, 0.05], [5, 0.035], [7, 0.02]]
    .map(([k, a]) => ({ k, a: a * lumps * (0.5 + rnd()), p: rnd() * Math.PI * 2 }));
  const wobble = (t) => 1 + waves.reduce((s, w) => s + w.a * Math.sin(w.k * t + w.p), 0);

  const STEPS = 120;
  let peak = 0;
  for (let i = 0; i < STEPS; i++) peak = Math.max(peak, wobble((i / STEPS) * Math.PI * 2));
  const r0 = Math.min(R, fit / peak);
  const radius = (t) => r0 * wobble(t);

  const pts = [];
  for (let i = 0; i < STEPS; i++) {
    const t = (i / STEPS) * Math.PI * 2;
    const r = radius(t);
    pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r * squash]);
  }
  return { pts, radius, R: r0, squash, cx, cy };
}

/** Somewhere inside a shape, within `spread` of the way out to its edge. */
function spot(rnd, shape, spread) {
  const a = rnd() * Math.PI * 2;
  const d = Math.sqrt(rnd()) * shape.radius(a) * spread;
  return [shape.cx + Math.cos(a) * d, shape.cy + Math.sin(a) * d * shape.squash];
}

/** Multiply one layer's coverage by another's alpha (premultiplied-safe). */
function maskBy(L, mask) {
  for (let i = 0; i < L.d.length; i += 4) {
    const m = mask.d[i + 3];
    L.d[i] *= m; L.d[i + 1] *= m; L.d[i + 2] *= m; L.d[i + 3] *= m;
  }
}

/**
 * Limb darkening plus light from the upper left, as on the planets, but
 * measured against the rock's own outline. Dividing by one radius, the way the
 * planets do, shades a lumpy rock as if it were the round body inside it, and
 * every lump outside that circle goes flat.
 */
function shadeRock(L, spec, shape, { ambient = 0.2, falloff = 2.2, rim = 0.46 } = {}) {
  L.shade((px, py) => {
    const x = px / SS - spec.ax - shape.cx;
    const y = py / SS - spec.ay - shape.cy;
    const ys = y / shape.squash;
    const d = Math.min(1, Math.hypot(x, ys) / shape.radius(Math.atan2(ys, x)));
    const lit = (-x - y) / (shape.R * 1.5);
    return Math.max(ambient, 1 - Math.pow(d, falloff) * 0.78 + lit * rim);
  });
}

function paintSurface(c, shape, pal, rnd, { blotches = 6, craters = 5, frost = 0, grain = Math.round(shape.R * 3) }) {
  const R = shape.R;
  // Regolith: specks too small to read as features, which is what keeps a rock
  // from looking like smooth plastic.
  for (let i = 0; i < grain; i++) {
    const [x, y] = spot(rnd, shape, 0.98);
    c.disc(x, y, 0.4 + rnd() * 0.8, rnd() < 0.5 ? pal.dark : pal.light, 0.12 + rnd() * 0.16);
  }
  for (let i = 0; i < blotches; i++) {
    const [x, y] = spot(rnd, shape, 0.9);
    c.softDisc(x, y, R * (0.18 + rnd() * 0.32), rnd() < 0.55 ? pal.dark : pal.light, 0.3, 1.2, 'over');
  }
  // Craters as on the moon: shadow on the near wall, light on the far wall. The
  // other way round they read as bumps rather than holes.
  for (let i = 0; i < craters; i++) {
    const [x, y] = spot(rnd, shape, 0.75);
    const r = R * (0.07 + rnd() * 0.13);
    c.disc(x - r * 0.13, y - r * 0.13, r * 1.1, pal.light, 0.35);
    c.disc(x, y, r, pal.base, 0.8);
    c.disc(x - r * 0.18, y - r * 0.18, r * 0.8, pal.dark, 0.45);
    c.disc(x + r * 0.26, y + r * 0.26, r * 0.45, pal.light, 0.3);
  }
  // Pinpricks of bright frost, which is what tells an icy body from a pale rock.
  for (let i = 0; i < frost; i++) {
    const [x, y] = spot(rnd, shape, 0.95);
    c.disc(x, y, 0.5 + rnd() * 1.2, WHITE, 0.2 + rnd() * 0.35);
  }
}

/**
 * One rock: the base fill, surface detail masked to the outline (blotches near
 * the edge spill off it otherwise, as they did off the planets), then shading
 * over the lot. `extra` paints whatever one rock has that the others do not.
 */
function buildRock(spec, shape, pal, rnd, surface = {}, extra = null) {
  const { L, c } = newCell(spec);
  c.poly(shape.pts, pal.base);

  const mask = new Layer(L.w, L.h);
  new Ctx(mask, spec.ax, spec.ay).poly(shape.pts, WHITE, 1);

  const det = new Layer(L.w, L.h);
  const dc = new Ctx(det, spec.ax, spec.ay);
  paintSurface(dc, shape, pal, rnd, surface);
  if (extra) extra(dc, shape);
  maskBy(det, mask);
  L.drawLayer(det);

  shadeRock(L, spec, shape, surface.shade);
  return L;
}

/* ------------------------------------------------------------------ *
 * The kit
 * ------------------------------------------------------------------ */

/**
 * Most of the belt is red: tholins, organics cooked out of surface ice by
 * billions of years of faint sunlight and cosmic rays. Some of it is neutral
 * grey, and a few bodies are fresh, bright ice.
 */
const PAL = {
  red: { base: hex('#a8674d'), dark: hex('#6f3f2f'), light: hex('#cf9677') },
  rust: { base: hex('#8f6b54'), dark: hex('#5b4233'), light: hex('#b99474') },
  grey: { base: hex('#8e8b89'), dark: hex('#5d5a5a'), light: hex('#bbb7b2') },
  ice: { base: hex('#c6d3df'), dark: hex('#8b9caf'), light: hex('#eef4fa') },
};

const ROCKS = [
  { name: 'kbo_0', pal: 'red', R: 40, lumps: 1.0, squash: 0.86, surface: { blotches: 7, craters: 6 } },
  { name: 'kbo_1', pal: 'red', R: 34, lumps: 1.3, squash: 0.62, surface: { blotches: 6, craters: 4 } },
  { name: 'kbo_2', pal: 'grey', R: 36, lumps: 0.8, squash: 0.9, surface: { blotches: 5, craters: 10 } },
  { name: 'kbo_3', pal: 'rust', R: 33, lumps: 1.4, squash: 0.8, surface: { blotches: 7, craters: 5 } },
  { name: 'kbo_4', pal: 'ice', R: 38, lumps: 0.9, squash: 0.84, surface: { blotches: 5, craters: 4, frost: 26 } },
  { name: 'kbo_5', pal: 'ice', R: 26, lumps: 0.7, squash: 0.72, surface: { blotches: 4, craters: 2, frost: 14 } },
];

// Gentler lumps than the big rocks: a few pixels across, one deep notch is all
// an outline has left, and it reads as a little heart. kbo_5 is kept gentle for
// the same reason, since it is mostly drawn small.
const PEBBLES = ['red', 'grey', 'rust', 'ice', 'red', 'rust'].map((pal, i) => ({
  name: `pebble_${i}`,
  pal,
  R: 11 + (i % 3) * 1.5,
  lumps: 0.7,
  squash: 0.7 + (i % 2) * 0.2,
  surface: { blotches: 3, craters: i % 2, frost: pal === 'ice' ? 6 : 0 },
}));

function renderRock(def, spec, fit) {
  const rnd = mulberry32(seedOf(def.name));
  const shape = lumpy(rnd, def.R, { lumps: def.lumps, squash: def.squash, fit });
  return buildRock(spec, shape, PAL[def.pal], rnd, def.surface);
}

const ARROKOTH = { base: hex('#b57a5e'), dark: hex('#7c4836'), light: hex('#dca78a') };

/**
 * Arrokoth: two lobes that drifted together slowly enough to stick rather than
 * shatter. Built as two rocks, each shaded as a body of its own, the smaller
 * one in front, with the pale band New Horizons saw around the neck where they
 * meet. The lobes overlap by more than their lumps can take back, so the neck
 * never opens into a gap.
 */
function renderArrokoth() {
  const rnd = mulberry32(seedOf('arrokoth'));
  const { L } = newCell(ROCK);
  const big = lumpy(rnd, 30, { lumps: 0.4, squash: 0.8, cx: -17, cy: 3, fit: 44 });
  const small = lumpy(rnd, 21, { lumps: 0.35, squash: 0.9, cx: 23, cy: -3, fit: 38 });

  L.drawLayer(buildRock(ROCK, big, ARROKOTH, rnd, { blotches: 6, craters: 3 }));
  L.drawLayer(buildRock(ROCK, small, ARROKOTH, rnd, { blotches: 4, craters: 1 }, (c, s) => {
    // the big crater on the small lobe
    c.disc(s.cx + 4, s.cy - 2, 6.5, ARROKOTH.dark, 0.5);
    c.disc(s.cx + 5.2, s.cy - 0.8, 4, ARROKOTH.base, 0.6);
  }));

  const neck = new Layer(L.w, L.h);
  new Ctx(neck, ROCK.ax, ROCK.ay).softDisc(7, 0, 11, ARROKOTH.light, 0.55, 1.5, 'over');
  maskBy(neck, L);
  L.drawLayer(neck);
  return L;
}

const HAUMEA = { base: hex('#d8dee6'), dark: hex('#9ba8b6'), light: hex('#f5f8fb') };

/**
 * Haumea: stretched twice as long as it is wide by one of the fastest spins in
 * the solar system, and coated in clean crystalline ice apart from one dark red
 * spot.
 */
function renderHaumea() {
  const rnd = mulberry32(seedOf('haumea'));
  const shape = lumpy(rnd, 50, { lumps: 0.12, squash: 0.5, fit: 58 });
  return buildRock(ROCK, shape, HAUMEA, rnd, { blotches: 5, craters: 2, frost: 30 }, (c) => {
    c.softDisc(12, -3, 10, hex('#8f3e36'), 0.6, 1.3, 'over');
  });
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

console.log('drawing the Kuiper belt…');

const rocks = ROCKS.map((def) => ({ name: def.name, layer: renderRock(def, ROCK, 60) }));
rocks.push({ name: 'arrokoth', layer: renderArrokoth() }, { name: 'haumea', layer: renderHaumea() });
const pebbles = PEBBLES.map((def) => ({ name: def.name, layer: renderRock(def, PEBBLE, 18) }));

const { sheet, frames, size } = packSections([
  { cols: 4, spec: ROCK, cells: rocks },
  { cols: 6, spec: PEBBLE, cells: pebbles },
]);

const atlas = {
  id: 'kuiper',
  image: 'kuiper.png',
  note: 'Draw at (x - ax, y - ay); every frame is anchored at its centre. A kit rather than a sequence: the game scatters many turned and scaled copies of each.',
  size,
  // The generic rocks, scattered by the dozen. Arrokoth and Haumea are left
  // out: each is one real object, placed once.
  bodies: ROCKS.map((def) => def.name),
  pebbles: PEBBLES.map((def) => def.name),
  frames,
};

const bytes = writeSheet(OUT_DIR, 'kuiper', sheet, atlas);
writeAtlasGlobal(OUT_DIR, 'atlas.js', { KUIPER_ATLAS: atlas }, 'gen-kuiper.mjs');

console.log(
  `  kuiper.png  ${size.w}×${size.h}  ` +
  `${Object.keys(frames).length} frames  ${(bytes / 1024).toFixed(0)} KB`
);
