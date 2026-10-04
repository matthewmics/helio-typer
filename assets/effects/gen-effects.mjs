/**
 * HelioTyper effects generator: particle textures and the hull-breach burst.
 *
 * Run with:  node assets/effects/gen-effects.mjs
 *
 * The particle textures (smoke, spark, ember, star) are deliberately WHITE with
 * only form shading baked in, because they are meant to be tinted at runtime.
 * The game multiplies them by a tint colour, so a white source can become warm
 * launch smoke, cold high-altitude smoke or grey damage smoke from one texture.
 * Baking a colour in would force one sheet per mood.
 *
 * The breach burst is the exception: it is a complete effect rather than a
 * particle, so it carries its own electric palette — the same one the rockets'
 * zap overlay uses, so the two read as the same phenomenon.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SS, mulberry32, seedOf, Layer, blur, hex, Ctx, newCell,
  packSections, writeSheet, writeAtlasGlobal,
} from '../lib/raster.mjs';

const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));

const WHITE = [1, 1, 1];
const ARC = { core: hex('#ffffff'), mid: hex('#a6f2ff'), outer: hex('#38a8ff') };

const PUFF = { w: 96, h: 96, ax: 48, ay: 48 };
const DOT = { w: 32, h: 32, ax: 16, ay: 16 };
const BURST = { w: 192, h: 192, ax: 96, ay: 96 };

/* ------------------------------------------------------------------ *
 * Smoke — four billow shapes so a particle burst doesn't visibly repeat
 * ------------------------------------------------------------------ */

function renderSmoke(variant) {
  const { L, c } = newCell(PUFF);
  const rnd = mulberry32(seedOf(`smoke${variant}`));

  // A ring of lobes plus a fat core reads as one cauliflower mass; a scatter of
  // equal discs just reads as a blurry circle.
  const lobes = [{ x: 0, y: 2, r: 21 + rnd() * 4 }];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.55;
    const rr = 13 + rnd() * 9;
    lobes.push({
      x: Math.cos(a) * rr * 1.05,
      y: Math.sin(a) * rr * 0.82 + 2,
      r: 11 + rnd() * 9,
    });
  }
  for (const l of lobes) c.softDisc(l.x, l.y, l.r, WHITE, 0.5, 0.7, 'over');

  // form shading: lit from above, so the underside stays heavy once tinted
  const top = -34 * SS + L.h / 2, bot = 34 * SS + L.h / 2;
  L.shade((x, y) => {
    const t = Math.max(0, Math.min(1, (y - top) / (bot - top)));
    return 1 - t * 0.48;
  });

  return blur(L, Math.max(1, Math.round(0.8 * SS)));
}

/* ------------------------------------------------------------------ *
 * Spark / ember / star
 * ------------------------------------------------------------------ */

function renderSpark() {
  const { L, c } = newCell(DOT);
  c.softDisc(0, 0, 8, WHITE, 0.75, 2.2, 'add');
  c.ellipse(0, 0, 13, 0.9, WHITE, 0.5, 'add');   // horizontal flare
  c.ellipse(0, 0, 0.9, 13, WHITE, 0.5, 'add');   // vertical flare
  c.ellipse(0, 0, 6.5, 0.6, WHITE, 0.35, 'add');
  c.disc(0, 0, 1.7, WHITE, 1, 'add');
  const glow = blur(L.clone(), Math.max(1, Math.round(1.2 * SS)));
  L.addLayer(glow, 0.6);
  return L;
}

function renderEmber() {
  const { L, c } = newCell(DOT);
  c.softDisc(0, 0, 9, WHITE, 0.7, 2.4, 'add');
  c.disc(0, 0, 2.4, WHITE, 0.95, 'add');
  return L;
}

function renderStar() {
  const { L, c } = newCell(DOT);
  c.softDisc(0, 0, 6.5, WHITE, 0.6, 3, 'add');
  c.disc(0, 0, 1.2, WHITE, 1, 'add');
  return L;
}

/* ------------------------------------------------------------------ *
 * Hull-breach burst
 *
 * The rockets' `zap` loop covers the sustained stall; this is the one-shot
 * moment hull hits zero. Non-looping, played once at the ship's centre.
 * ------------------------------------------------------------------ */

function jagged(p0, p1, segments, jitter, rnd) {
  const pts = [p0];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    pts.push([
      p0[0] + (p1[0] - p0[0]) * t + (rnd() - 0.5) * jitter * 2,
      p0[1] + (p1[1] - p0[1]) * t + (rnd() - 0.5) * jitter * 2,
    ]);
  }
  pts.push(p1);
  return pts;
}

function renderBreach(frame) {
  const { L } = newCell(BURST);
  const rnd = mulberry32(seedOf(`breach${frame}`));
  const fx = new Layer(L.w, L.h);
  const c = new Ctx(fx, BURST.ax, BURST.ay);

  const flash = [1, 0.55, 0.25, 0.1, 0, 0, 0, 0][frame];
  const ringA = [0, 0.95, 1, 0.85, 0.65, 0.45, 0.26, 0.12][frame];
  const R = 10 + frame * 9.6;           // capped so the ring stays inside the cell
  const thick = 9.5 - frame * 0.55;

  // white-out on impact
  if (flash > 0) {
    c.softDisc(0, 0, 34 + frame * 8, ARC.core, flash * 0.85, 2, 'add');
    c.softDisc(0, 0, 62 + frame * 10, ARC.mid, flash * 0.35, 2.4, 'add');
  }

  // Shock ring, drawn as jittered blobs so the edge crackles rather than
  // reading as a clean vector circle. Step count scales with circumference —
  // a fixed count leaves visible gaps once the ring is large.
  if (ringA > 0) {
    const steps = Math.max(90, Math.ceil((2 * Math.PI * R) / (thick * 0.45)));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const rr = R * (1 + (rnd() - 0.5) * 0.12);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.94;
      c.softDisc(x, y, thick * 0.9, ARC.outer, ringA * 0.13, 1.5, 'add');
      c.softDisc(x, y, thick * 0.48, ARC.mid, ringA * 0.17, 1.6, 'add');
      c.softDisc(x, y, thick * 0.2, ARC.core, ringA * 0.2, 1.8, 'add');
    }
  }

  // radial bolts firing out through the ring — only while it's still violent
  const bolts = frame >= 1 && frame <= 5 ? 8 - frame : 0;
  for (let i = 0; i < bolts; i++) {
    const a = rnd() * Math.PI * 2;
    const reach = R * (0.6 + rnd() * 0.3);
    const p = jagged([0, 0], [Math.cos(a) * reach, Math.sin(a) * reach], 5, R * 0.1, rnd);
    const k = ringA;
    c.thickLine(p, 4.2, ARC.outer, 0.26 * k, 'add');
    c.thickLine(p, 2.2, ARC.mid, 0.45 * k, 'add');
    c.thickLine(p, 1.0, ARC.core, 0.7 * k, 'add');
  }

  // debris sparks thrown past the ring
  const sparks = Math.round(26 * Math.max(0, 1 - frame / 8));
  for (let i = 0; i < sparks; i++) {
    const a = rnd() * Math.PI * 2;
    const d = R * (0.85 + rnd() * 0.5);
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.95;
    const rr = 0.8 + rnd() * 1.6;
    const k = Math.max(ringA, flash);
    c.softDisc(x, y, rr * 2.6, ARC.mid, 0.4 * k, 2, 'add');
    c.disc(x, y, rr, ARC.core, 0.85 * k, 'add');
  }

  L.addLayer(blur(fx, Math.round(3 * SS)), 0.7);
  L.addLayer(fx, 1);
  return L;
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

console.log('drawing effects…');

const puffs = [];
for (let i = 0; i < 4; i++) puffs.push({ name: `smoke_${i}`, layer: renderSmoke(i) });

const dots = [
  { name: 'spark', layer: renderSpark() },
  { name: 'ember', layer: renderEmber() },
  { name: 'star', layer: renderStar() },
];

const breach = [];
for (let f = 0; f < 8; f++) breach.push({ name: `breach_${f}`, layer: renderBreach(f) });

const { sheet, frames, size } = packSections([
  { cols: 8, spec: PUFF, cells: puffs },
  { cols: 8, spec: DOT, cells: dots },
  { cols: 4, spec: BURST, cells: breach },
]);

const atlas = {
  id: 'effects',
  image: 'effects.png',
  note: 'Draw at (x - ax, y - ay); every frame is anchored at its centre. smoke/spark/ember/star are white — tint them at runtime. breach is pre-coloured.',
  size,
  tintable: ['smoke_0', 'smoke_1', 'smoke_2', 'smoke_3', 'spark', 'ember', 'star'],
  frames,
  animations: {
    smoke: { frames: puffs.map((p) => p.name) },   // pick at random per particle
    breach: { frames: breach.map((b) => b.name), fps: 16, loop: false },
  },
};

const bytes = writeSheet(OUT_DIR, 'effects', sheet, atlas);
writeAtlasGlobal(OUT_DIR, 'atlas.js', { FX_ATLAS: atlas }, 'gen-effects.mjs');

console.log(
  `  effects.png  ${size.w}×${size.h}  ` +
  `${Object.keys(frames).length} frames  ${(bytes / 1024).toFixed(0)} KB`
);
