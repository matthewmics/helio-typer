/**
 * HelioTyper sprite generator.
 *
 * Draws the rockets procedurally and writes one self-contained sheet per
 * rocket (<id>.png + <id>.json), plus index.json and atlas.js, alongside this
 * file in assets/rockets/.
 * Zero dependencies — software rasteriser, PNG encoded by hand over node:zlib.
 * Run with:  node assets/rockets/gen-rockets.mjs
 *
 * Output is deterministic: rerunning produces byte-identical files, and adding
 * a rocket to ROSTER does not disturb any existing sheet.
 *
 * Everything is authored in *game units*, the same scale drawRocket() already
 * uses in prototype.html (nose at y=-46, hull base at y=30, fin tips at x=±34),
 * so a sprite drawn at its anchor lands exactly where the vector ship was.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SS, mulberry32, seedOf, makeNoise, Layer, blur, dilateAlpha, hex, Ctx,
  profilePoly, lerpProfile, newCell, packSections, writeSheet, writeAtlasGlobal,
} from '../lib/raster.mjs';

const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ *
 * Palettes
 * ------------------------------------------------------------------ */

const OUTLINE = hex('#12142a');

const SHIPS = {
  A: {
    name: 'vanguard',
    hullLight: hex('#f4f6ff'), hullMid: hex('#d3d8ee'), hullDark: hex('#9099bd'),
    accent: hex('#ff5d6c'), accentDark: hex('#c2374a'),
    metal: hex('#3a4160'), metalDark: hex('#232841'),
    glass: hex('#63d2ff'), glassDark: hex('#1d5b91'),
  },
  B: {
    name: 'kestrel',
    hullLight: hex('#eef2f8'), hullMid: hex('#c3ccdd'), hullDark: hex('#7d88a4'),
    accent: hex('#2fe3c8'), accentDark: hex('#0f9b88'),
    metal: hex('#39415e'), metalDark: hex('#212639'),
    glass: hex('#ffcf66'), glassDark: hex('#9a5f16'),
  },
  // Gunmetal rather than true black: the sky goes to near-black at the top of
  // the climb, and a genuinely dark hull would lose its silhouette up there.
  C: {
    name: 'marauder',
    hullLight: hex('#7c87ae'), hullMid: hex('#59617f'), hullDark: hex('#363c53'),
    accent: hex('#ff2d4b'), accentDark: hex('#a2122e'),
    metal: hex('#232838'), metalDark: hex('#141723'),
    glass: hex('#ff7a4a'), glassDark: hex('#7d2312'),
  },
  // Olive drab and hazard yellow: a working machine rather than a racer.
  D: {
    name: 'bulwark',
    hullLight: hex('#c5cf96'), hullMid: hex('#97a266'), hullDark: hex('#626b42'),
    accent: hex('#ffcc33'), accentDark: hex('#c08f14'),
    metal: hex('#3b4157'), metalDark: hex('#232739'),
    glass: hex('#8ff5dc'), glassDark: hex('#1f7f6b'),
  },
  // Jade hull, gold ring, rose canopy.
  E: {
    name: 'halcyon',
    hullLight: hex('#7fe3c6'), hullMid: hex('#3fb394'), hullDark: hex('#237563'),
    accent: hex('#ffd36b'), accentDark: hex('#c48a22'),
    metal: hex('#2b3350'), metalDark: hex('#1a1f33'),
    glass: hex('#ff9ee0'), glassDark: hex('#8f2c72'),
  },
  // Indigo twin hulls with crimson noses.
  F: {
    name: 'gemini',
    hullLight: hex('#a9b2ff'), hullMid: hex('#6f78e0'), hullDark: hex('#454c9e'),
    accent: hex('#ff3b5c'), accentDark: hex('#b0153a'),
    metal: hex('#2c3150'), metalDark: hex('#1a1d33'),
    glass: hex('#9ff3ff'), glassDark: hex('#2a7f99'),
  },
  // Chrome saucer with lime running lights, and someone looking out.
  G: {
    name: 'visitor',
    hullLight: hex('#eef1f7'), hullMid: hex('#b7bfd0'), hullDark: hex('#737d96'),
    accent: hex('#b6ff3b'), accentDark: hex('#5f9e12'),
    metal: hex('#3d4459'), metalDark: hex('#242838'),
    glass: hex('#b6ffd8'), glassDark: hex('#2f8a66'),
    alien: hex('#5aa86a'), alienEye: hex('#0d1712'),
  },
  // A champagne foil sail over a small white craft.
  H: {
    name: 'sunjammer',
    hullLight: hex('#f1f4fa'), hullMid: hex('#c7cddc'), hullDark: hex('#848ea8'),
    accent: hex('#f3e7c4'), accentDark: hex('#b39a5e'),
    metal: hex('#2f3550'), metalDark: hex('#1b1f31'),
    glass: hex('#7fe7ff'), glassDark: hex('#1e6f8f'),
  },
  // White stages in a black roll pattern, under a red escape tower.
  I: {
    name: 'pioneer',
    hullLight: hex('#f7f8fc'), hullMid: hex('#d6d9e4'), hullDark: hex('#969cb2'),
    accent: hex('#2b2f40'), accentDark: hex('#171a26'),
    metal: hex('#3a4058'), metalDark: hex('#22263a'),
    glass: hex('#8fd8ff'), glassDark: hex('#245f8a'),
    tower: hex('#ff4b3e'), towerDark: hex('#b3241c'),
  },
  // Rust, with a teal patch that came off something else.
  J: {
    name: 'junker',
    hullLight: hex('#dea27a'), hullMid: hex('#ab6b45'), hullDark: hex('#6e3f27'),
    accent: hex('#43c9b6'), accentDark: hex('#1f8173'),
    metal: hex('#5a5f6e'), metalDark: hex('#2f333f'),
    glass: hex('#ffd166'), glassDark: hex('#a8741a'),
  },
  // Petrol blue back, pale shoulder marks, pink wingtips.
  K: {
    name: 'manta',
    hullLight: hex('#6cc0d4'), hullMid: hex('#2f7f96'), hullDark: hex('#1c4f60'),
    accent: hex('#ff6fb5'), accentDark: hex('#b8326f'),
    metal: hex('#28324a'), metalDark: hex('#171d2e'),
    glass: hex('#e8f7ff'), glassDark: hex('#5d8fa8'),
    marks: hex('#dff2f6'),
  },
  // Lilac pearl body and gold claws holding a crystal.
  L: {
    name: 'prism',
    hullLight: hex('#f4eeff'), hullMid: hex('#cdc2ec'), hullDark: hex('#8b81b5'),
    accent: hex('#ffd36b'), accentDark: hex('#b88a2a'),
    metal: hex('#2e3150'), metalDark: hex('#1b1d33'),
    glass: hex('#9ff6ff'), glassDark: hex('#3b6fb0'),
    facets: {
      top: hex('#f2fbff'), cyan: hex('#7cf3ff'), violet: hex('#b38cff'),
      blue: hex('#8aa8ff'), pink: hex('#ff8ad6'), gold: hex('#fff27a'),
      green: hex('#9dffc0'), pale: hex('#e3f4ff'),
    },
  },
};

const FLAME = {
  A: {
    outer: hex('#ff4d18'), mid: hex('#ff8c2b'),
    inner: hex('#ffc94d'), core: hex('#fff2cf'), hot: hex('#ffffff'),
  },
  B: {
    outer: hex('#2a6cff'), mid: hex('#38a6ff'),
    inner: hex('#7cefff'), core: hex('#dcffff'), hot: hex('#ffffff'),
  },
  // Third distinct exhaust colour — orange / blue / violet stay separable at a
  // glance, which is what identifies players in a crowded race.
  C: {
    outer: hex('#8c14ff'), mid: hex('#e03cff'),
    inner: hex('#ff9cf5'), core: hex('#ffd9fb'), hot: hex('#ffffff'),
  },
  // Gold, green and crimson complete the classic six player colours, so a full
  // lobby of six different rockets still reads as six different exhausts.
  D: {
    outer: hex('#d99a00'), mid: hex('#ffd21f'),
    inner: hex('#fff28a'), core: hex('#fffbe0'), hot: hex('#ffffff'),
  },
  E: {
    outer: hex('#00a640'), mid: hex('#22f07a'),
    inner: hex('#a0ffc6'), core: hex('#e4fff0'), hot: hex('#ffffff'),
  },
  F: {
    outer: hex('#b0001c'), mid: hex('#ff1f3d'),
    inner: hex('#ff7d8c'), core: hex('#ffd9de'), hot: hex('#ffffff'),
  },
  // Six more fill the gaps around the wheel (lime, teal, ultramarine, pink),
  // then step off it: an ion white with no hue, and Prism's light split into
  // a spectrum (see PRISM_BEAMS). Twelve can no longer all be far apart, so
  // teal/green and ultramarine/blue are the closest pairs.
  G: {
    outer: hex('#5fae00'), mid: hex('#a8ff1f'),
    inner: hex('#e8ff9e'), core: hex('#f9ffe4'), hot: hex('#ffffff'),
  },
  H: {
    outer: hex('#6f86c9'), mid: hex('#bcd2ff'),
    inner: hex('#eef4ff'), core: hex('#ffffff'), hot: hex('#ffffff'),
  },
  I: {
    outer: hex('#3a2cff'), mid: hex('#6a7dff'),
    inner: hex('#b9c4ff'), core: hex('#eef0ff'), hot: hex('#ffffff'),
  },
  J: {
    outer: hex('#009478'), mid: hex('#18e6b8'),
    inner: hex('#a2ffe6'), core: hex('#e4fff8'), hot: hex('#ffffff'),
  },
  K: {
    outer: hex('#d1007a'), mid: hex('#ff4fb0'),
    inner: hex('#ffa6d6'), core: hex('#ffe3f2'), hot: hex('#ffffff'),
  },
  // White light for the flash and nozzle glow, scattering sparks of every colour.
  L: {
    outer: hex('#c9c2ff'), mid: hex('#efeaff'),
    inner: hex('#ffffff'), core: hex('#ffffff'), hot: hex('#ffffff'),
    sparks: ['#ff4b4b', '#ff9d2e', '#fff04a', '#5dff7a', '#3fe8ff', '#5a7dff', '#c06bff'].map(hex),
  },
};

/**
 * Prism's light, split. Additive shells always mix toward white, so one plume
 * cannot show bands of colour; three thin beams side by side can. They blend to
 * white where they overlap and leave red and violet fringes either side, the
 * way a prism does.
 */
const PRISM_BEAMS = {
  red: {
    outer: hex('#ff1f1f'), mid: hex('#ff5a3c'),
    inner: hex('#ffb38a'), core: hex('#ffe6dc'), hot: hex('#ffffff'),
  },
  green: {
    outer: hex('#18c94a'), mid: hex('#5dff7a'),
    inner: hex('#c9ffb8'), core: hex('#f0fff0'), hot: hex('#ffffff'),
  },
  violet: {
    outer: hex('#6a2cff'), mid: hex('#4f7dff'),
    inner: hex('#a9c2ff'), core: hex('#eef2ff'), hot: hex('#ffffff'),
  },
};

const ARC = { core: hex('#ffffff'), mid: hex('#a6f2ff'), outer: hex('#38a8ff') };

/* ------------------------------------------------------------------ *
 * Ship geometry
 * ------------------------------------------------------------------ */

const shipA = {
  hw(y) {
    if (y < -18) { const t = (y + 18) / -28; return 17 * Math.sqrt(Math.max(0, 1 - t * t)); }
    if (y < 20) return 17;
    return 17 + 5 * Math.pow((y - 20) / 10, 1.4);
  },
  top: -46, bottom: 30,
  // `main` nozzles get the mach diamonds and the white-hot core; `exhaust` is
  // the single point the blastoff cloud, flash and sparks radiate from.
  nozzles: [{ x: 0, y: 38, lenK: 1, widK: 1, alpha: 1, main: true }],
  exhaust: { x: 0, y: 38 },
  // Points lightning is allowed to attach to.
  arcPoints: [
    [0, -44], [-8, -30], [8, -30], [-17, -12], [17, -12], [-17, 6], [17, 6],
    [-19, 22], [19, 22], [-33, 31], [33, 31], [-13, 37], [13, 37], [0, -20],
  ],
};

const shipB = {
  hw(y) {
    if (y < -16) { const t = (y + 16) / -34; return 12 * Math.sqrt(Math.max(0, 1 - t * t)); }
    if (y < 24) return 12;
    return 12 + 2 * ((y - 24) / 6);
  },
  top: -50, bottom: 30,
  nozzles: [
    { x: 0, y: 40, lenK: 1, widK: 1, alpha: 1, main: true },
    { x: -19, y: 37, lenK: 0.52, widK: 0.5, alpha: 0.95, main: false },
    { x: 19, y: 37, lenK: 0.52, widK: 0.5, alpha: 0.95, main: false },
  ],
  exhaust: { x: 0, y: 40 },
  arcPoints: [
    [0, -48], [-6, -32], [6, -32], [-12, -12], [12, -12], [-12, 10], [12, 10],
    [-19, -12], [19, -12], [-26, 4], [26, 4], [-26, 26], [26, 26],
    [-34, 33], [34, 33], [-19, 36], [19, 36], [0, 39],
  ],
};

/**
 * Ships are drawn as a back-to-front stack of `part(fn)` calls. Each part is
 * rasterised into its own layer and gets its own dark keyline before being
 * composited, so overlapping pieces (fins behind hull, boosters beside
 * fuselage) stay separated instead of fusing into one pale mass.
 */
function drawShipA(part) {
  const p = SHIPS.A, hw = shipA.hw;

  part((c) => { // engine bell
    c.poly([[-12, 24], [12, 24], [16, 40], [-16, 40]], p.metal);
    c.poly([[-16, 40], [16, 40], [14, 43], [-14, 43]], p.metalDark);
    c.ellipse(0, 39, 13, 3.2, p.metalDark);
  });

  part((c) => { // fins
    for (const s of [-1, 1]) {
      c.poly([[16 * s, 2], [34 * s, 32], [16 * s, 26]], p.accent);
      c.poly([[24 * s, 18], [34 * s, 32], [20 * s, 25]], p.accentDark, 0.85);
    }
  });

  part((c) => { // hull
    c.poly(profilePoly(hw, shipA.top, 30), p.hullMid);
    c.poly(profilePoly(hw, shipA.top, 30, -1, -0.28), p.hullLight);
    c.poly(profilePoly(hw, shipA.top, 30, 0.42, 1), p.hullDark, 0.55);

    // red nose cap and waist band
    c.poly(profilePoly(hw, shipA.top, -22), p.accent);
    c.poly(profilePoly(hw, shipA.top, -22, -1, -0.28), p.accent, 0.45);
    c.poly(profilePoly(hw, shipA.top, -22, 0.42, 1), p.accentDark, 0.5);
    c.poly(profilePoly(hw, 12, 20), p.accent);
    c.poly(profilePoly(hw, 12, 20, 0.42, 1), p.accentDark, 0.5);

    // panel lines
    c.poly(profilePoly(hw, -1.2, 0.4), p.hullDark, 0.35);
    c.poly(profilePoly(hw, 23.5, 25), p.hullDark, 0.3);

    // window
    c.disc(0, -8, 10, p.metal);
    c.disc(0, -8, 8.2, p.glassDark);
    c.disc(0.8, -6.8, 7.2, p.glass);
    c.disc(-2.2, -10.5, 3, [1, 1, 1], 0.8);
    c.disc(2.6, -4.4, 1.6, [1, 1, 1], 0.35);

    for (const s of [-1, 1]) c.disc(11 * s, 27, 1.4, p.hullDark, 0.6);
  });
}

/**
 * Kestrel — a strapped-booster interceptor. Deliberately a different
 * silhouette from the Vanguard rather than a recolour: narrow fuselage,
 * two full-length side boosters, winglets outboard of them.
 */
function drawShipB(part) {
  const p = SHIPS.B, hw = shipB.hw;
  const bhw = (y) => (y < -2 ? 7 * Math.sqrt(Math.max(0, 1 - Math.pow((y + 2) / 14, 2))) : 7);

  part((c) => { // winglets, outboard of the boosters
    for (const s of [-1, 1]) {
      c.poly([[22 * s, 8], [38 * s, 36], [22 * s, 30]], p.accent);
      c.poly([[31 * s, 24], [38 * s, 36], [26 * s, 31]], p.accentDark, 0.9);
    }
  });

  part((c) => { // main engine bell, behind the fuselage
    c.poly([[-9, 28], [9, 28], [13, 40], [-13, 40]], p.metal);
    c.poly([[-13, 40], [13, 40], [11, 43], [-11, 43]], p.metalDark);
    c.ellipse(0, 39.5, 10.5, 2.6, p.metalDark);
  });

  for (const s of [-1, 1]) {
    part((c) => { // strapped booster
      const bx = 19 * s;
      const shift = (pts) => pts.map(([x, y]) => [x + bx, y]);
      c.poly([[bx - 5.5, 28], [bx + 5.5, 28], [bx + 7.5, 38], [bx - 7.5, 38]], p.metal);
      c.ellipse(bx, 37.5, 7, 2, p.metalDark);
      c.poly(shift(profilePoly(bhw, -16, 30)), p.hullMid);
      c.poly(shift(profilePoly(bhw, -16, 30, -1, -0.2)), p.hullLight, 0.95);
      c.poly(shift(profilePoly(bhw, -16, 30, 0.35, 1)), p.hullDark, 0.6);
      c.poly(shift(profilePoly(bhw, -16, -6)), p.accent);       // teal nose cone
      c.poly(shift(profilePoly(bhw, -16, -6, 0.35, 1)), p.accentDark, 0.5);
      c.poly(shift(profilePoly(bhw, 18, 22)), p.metal, 0.55);   // band
    });
  }

  part((c) => { // fuselage
    c.poly(profilePoly(hw, shipB.top, 32), p.hullMid);
    c.poly(profilePoly(hw, shipB.top, 32, -1, -0.25), p.hullLight);
    c.poly(profilePoly(hw, shipB.top, 32, 0.4, 1), p.hullDark, 0.55);

    // graphite nose, teal waist band
    c.poly(profilePoly(hw, shipB.top, -22), p.metal);
    c.poly(profilePoly(hw, shipB.top, -22, -1, -0.25), p.metal, 0.4);
    c.poly(profilePoly(hw, 8, 15), p.accent);
    c.poly(profilePoly(hw, 8, 15, 0.4, 1), p.accentDark, 0.5);
    c.poly(profilePoly(hw, 26.5, 28), p.hullDark, 0.35);

    // hex canopy — amber glass, to read apart from the Vanguard's blue
    const hexAt = (r, cx, cy) => {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      return pts;
    };
    c.poly(hexAt(9.5, 0, -8), p.metal);
    c.poly(hexAt(7.8, 0, -8), p.glassDark);
    c.poly(hexAt(6.8, 0.5, -9), p.glass);
    c.poly(hexAt(2.8, -2.2, -11), [1, 1, 1], 0.75);
  });
}

/**
 * Marauder — the aggressive one. Everything about it is a deliberate inversion
 * of the other two: faceted straight-line hull instead of curved profiles, dark
 * gunmetal instead of pale cream, a visor slit instead of a round porthole,
 * forward barbs, huge raked scythe wings, and twin engines instead of one.
 */
const shipC = {
  hw: lerpProfile([[-50, 0], [-38, 4.5], [-30, 6.5], [-10, 8], [10, 10], [24, 14.5], [32, 14.5]]),
  top: -50, bottom: 32,
  // Two full-strength engines, but at reduced alpha: the plumes overlap and
  // additive blending would otherwise sum the centre to flat white, throwing
  // away the violet that identifies this ship.
  nozzles: [
    { x: -8, y: 41, lenK: 0.86, widK: 0.78, alpha: 0.78, main: true },
    { x: 8, y: 41, lenK: 0.86, widK: 0.78, alpha: 0.78, main: true },
  ],
  exhaust: { x: 0, y: 41 },
  arcPoints: [
    [0, -48], [-5, -34], [5, -34], [-8, -12], [8, -12], [-10, 8], [10, 8],
    [-14, 26], [14, 26], [-17, -21], [17, -21],
    [-40, 28], [40, 28], [-32, 36], [32, 36], [-24, 20], [24, 20],
    [-8, 40], [8, 40],
  ],
};

function drawShipC(part) {
  const p = SHIPS.C, hw = shipC.hw;

  // raked scythe wings — the widest, meanest part of the silhouette
  for (const s of [-1, 1]) {
    part((c) => {
      c.poly([[9 * s, -6], [40 * s, 28], [32 * s, 36], [11 * s, 24]], p.hullMid);
      c.poly([[40 * s, 28], [32 * s, 36], [21 * s, 27]], p.hullDark, 0.85);
      // crimson leading edge — kept a thin accent so the gunmetal armour reads
      // as the dominant colour, not a second red ship
      c.poly([[9 * s, -6], [40 * s, 28], [38.2 * s, 29.6], [7.2 * s, -4.4]], p.accent);
      c.poly([[28 * s, 17], [40 * s, 28], [38.2 * s, 29.6], [26.5 * s, 18.6]], p.accentDark, 0.6);
    });
  }

  // forward barbs
  for (const s of [-1, 1]) {
    part((c) => {
      c.poly([[5 * s, -31], [18 * s, -21], [6 * s, -16]], p.accent);
      c.poly([[18 * s, -21], [6 * s, -16], [9 * s, -19]], p.accentDark, 0.7);
    });
  }

  // twin engine block
  part((c) => {
    c.poly([[-16, 21], [16, 21], [15, 28], [-15, 28]], p.metalDark);
    for (const s of [-1, 1]) {
      c.poly([[2 * s, 26], [15 * s, 26], [14 * s, 42], [3 * s, 42]], p.metal);
      c.ellipse(8.5 * s, 41.5, 5.5, 1.9, p.metalDark);
    }
  });

  // faceted hull
  part((c) => {
    c.poly(profilePoly(hw, shipC.top, 32), p.hullMid);
    c.poly(profilePoly(hw, shipC.top, 32, -1, -0.3), p.hullLight);
    c.poly(profilePoly(hw, shipC.top, 32, 0.35, 1), p.hullDark, 0.6);
    c.poly(profilePoly(hw, shipC.top, 32, -0.16, 0.16), p.hullLight, 0.5); // spine ridge

    // dark armoured nose with a crimson spike tip
    c.poly(profilePoly(hw, shipC.top, -28), p.metal);
    c.poly(profilePoly(hw, shipC.top, -28, -1, -0.3), p.metal, 0.45);
    c.poly(profilePoly(hw, shipC.top, -39), p.accent);
    c.poly(profilePoly(hw, shipC.top, -39, 0.35, 1), p.accentDark, 0.55);
    c.poly([[-10, 4], [0, 0], [10, 4], [10, 9], [0, 5], [-10, 9]], p.accent);
    c.poly(profilePoly(hw, 25, 29), p.metalDark, 0.8);

    // hazard slashes low on the hull
    for (const s of [-1, 1]) {
      c.poly([[3 * s, 13], [8 * s, 13], [11 * s, 21], [6 * s, 21]], p.accentDark, 0.75);
    }

    // visor slit — a hostile squint instead of a friendly porthole
    c.poly([[-6.6, -19], [6.6, -19], [5.0, -6.6], [-5.0, -6.6]], p.metal);
    c.poly([[-5.4, -17.6], [5.4, -17.6], [4.0, -8.2], [-4.0, -8.2]], p.glassDark);
    c.poly([[-4.9, -16.9], [4.9, -16.9], [3.7, -9.8], [-3.7, -9.8]], p.glass);
    c.poly([[-4.5, -16.4], [-0.5, -16.4], [-1.5, -10.6], [-3.7, -10.6]], [1, 1, 1], 0.55);
  });
}

/** Points along an ellipse from angle a0 to a1, for rings and canopies. */
function arcPts(cx, cy, rx, ry, a0, a1, steps = 32) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** A lens-shaped canopy, pointed top and bottom and widest below the middle. */
function canopyPts(cx, yTop, yBot, w, steps = 24) {
  const half = (t) => w * Math.sin(Math.PI * Math.pow(t, 0.75));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([cx - half(t), yTop + (yBot - yTop) * t]);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    pts.push([cx + half(t), yTop + (yBot - yTop) * t]);
  }
  return pts;
}

/**
 * Bulwark — a heavy lander. Short and wide where the others are tall and
 * narrow: a glass dome on an armoured hab, landing legs splayed out past the
 * hull, and a cluster of three engines.
 */
const shipD = {
  // the hab only; the dome sits on top of it
  hw: lerpProfile([[-20, 17], [-16, 21], [-8, 24], [8, 24], [15, 19.5], [19, 16], [26, 13]]),
  top: -20, bottom: 26,
  nozzles: [
    { x: 0, y: 37, lenK: 0.9, widK: 1.05, alpha: 0.92, main: true },
    { x: -13.5, y: 32, lenK: 0.45, widK: 0.45, alpha: 0.85, main: false },
    { x: 13.5, y: 32, lenK: 0.45, widK: 0.45, alpha: 0.85, main: false },
  ],
  exhaust: { x: 0, y: 37 },
  arcPoints: [
    [0, -37], [-9, -33], [9, -33], [-16, -21], [16, -21], [-26, -6], [26, -6],
    [-24, 8], [24, 8], [-15, 21], [15, 21], [-28, 18], [28, 18], [-36, 34], [36, 34],
    [0, 31],
  ],
};

function drawShipD(part) {
  const p = SHIPS.D, hw = shipD.hw;

  // landing legs, behind the hull. Olive rather than metal: they are half the
  // silhouette, and dark struts vanish against the sky.
  for (const s of [-1, 1]) {
    part((c) => {
      c.thickLine([[15 * s, -2], [36 * s, 32]], 3.4, p.hullDark);
      c.thickLine([[19 * s, 15], [30 * s, 25]], 2.2, p.metal);
      c.poly([[30 * s, 32], [42 * s, 32], [40.5 * s, 36.5], [31.5 * s, 36.5]], p.metal);
      c.poly([[31 * s, 32], [41 * s, 32], [40.6 * s, 33.4], [31.4 * s, 33.4]], p.hullMid, 0.9);
    });
  }

  // engine cluster: one main bell between two verniers
  part((c) => {
    for (const s of [-1, 1]) {
      c.poly([[10 * s, 24], [17 * s, 24], [18 * s, 32], [9 * s, 32]], p.metal);
      c.ellipse(13.5 * s, 31.6, 4.6, 1.5, p.metalDark);
    }
    c.poly([[-9, 24], [9, 24], [12, 37], [-12, 37]], p.metal);
    c.poly([[-12, 37], [12, 37], [10.5, 39.5], [-10.5, 39.5]], p.metalDark);
    c.ellipse(0, 36.6, 10, 2.6, p.metalDark);
  });

  // RCS pods on the flanks
  for (const s of [-1, 1]) {
    part((c) => {
      c.poly([[21 * s, -11], [29 * s, -10], [29 * s, 1], [21 * s, 2]], p.metal);
      c.poly([[26.5 * s, -10.3], [29 * s, -10], [29 * s, 1], [26.5 * s, 1.3]], p.metalDark, 0.85);
      c.disc(28.6 * s, -4.5, 1.2, p.accent, 0.9);
    });
  }

  // armoured hab
  part((c) => {
    c.poly(profilePoly(hw, shipD.top, shipD.bottom), p.hullMid);
    c.poly(profilePoly(hw, shipD.top, shipD.bottom, -1, -0.3), p.hullLight);
    c.poly(profilePoly(hw, shipD.top, shipD.bottom, 0.4, 1), p.hullDark, 0.6);

    // collar the dome sits in, and the skirt over the engines
    c.poly(profilePoly(hw, shipD.top, -15), p.metal);
    c.poly(profilePoly(hw, shipD.top, -15, 0.4, 1), p.metalDark, 0.6);
    c.poly(profilePoly(hw, 20, shipD.bottom), p.metal);
    c.poly(profilePoly(hw, 20, shipD.bottom, 0.4, 1), p.metalDark, 0.6);

    // hazard band: yellow, with black slashes kept clear of the tapering edge
    c.poly(profilePoly(hw, 6, 14), p.accent);
    for (let k = 0; k < 5; k++) {
      const x = -17.5 + k * 7;
      c.poly([[x, 6], [x + 3.5, 6], [x + 7.5, 14], [x + 4, 14]], p.metalDark, 0.9);
    }
    c.poly(profilePoly(hw, 6, 14, 0.4, 1), p.accentDark, 0.45);

    // panel line and rivets
    c.poly(profilePoly(hw, -3.6, -2.6), p.hullDark, 0.45);
    for (const s of [-1, 1]) for (const y of [-9, 1]) c.disc(17 * s, y, 1.2, p.hullDark, 0.7);
  });

  // glass dome, with an antenna for a silhouette nobody else has
  part((c) => {
    c.thickLine([[5, -33], [9, -45]], 1.3, p.metal);
    c.disc(9, -45, 1.8, p.accent);
    const dome = (y) => 15 * Math.sqrt(Math.max(0, 1 - Math.pow((y + 20) / 18, 2)));
    c.poly(profilePoly(dome, -38, -20), p.glassDark);
    c.poly(profilePoly(dome, -36.5, -20, -0.86, 0.7), p.glass, 0.9);
    c.disc(0, -24, 5.5, p.metal, 0.55); // the pilot, a shadow under the glass
    c.ellipse(-5.2, -30, 2.8, 4.6, [1, 1, 1], 0.6);
    c.disc(5.5, -25, 1.4, [1, 1, 1], 0.35);
  });
}

/**
 * Halcyon — the ring wing. A slender jade needle threaded through a wide gold
 * ring, so its silhouette is the only one with gaps in it.
 */
const RING = { rx: 31, ry: 6.5, y: 12, chord: 8 };
const shipE = {
  hw(y) {
    if (y < -14) { const t = (y + 14) / -36; return 10 * Math.sqrt(Math.max(0, 1 - t * t)); }
    if (y < 22) return 10;
    return 10 + 2.5 * ((y - 22) / 8);
  },
  top: -50, bottom: 30,
  nozzles: [{ x: 0, y: 40, lenK: 1, widK: 0.95, alpha: 1, main: true }],
  exhaust: { x: 0, y: 40 },
  arcPoints: [
    [0, -48], [-5, -34], [5, -34], [-10, -12], [10, -12], [-10, 4], [10, 4],
    [-31, 15], [31, 15], [-24, 23], [24, 23], [0, 26], [-12, 29], [12, 29], [0, 39],
  ],
};

function drawShipE(part) {
  const p = SHIPS.E, hw = shipE.hw;
  const { rx, ry, y: ry0, chord } = RING;

  part((c) => { // far side of the ring, behind the hull
    c.poly([
      ...arcPts(0, ry0, rx, ry, Math.PI, 2 * Math.PI),
      ...arcPts(0, ry0, rx - 2.6, ry - 1.8, 2 * Math.PI, Math.PI),
    ], p.accentDark);
  });

  part((c) => { // engine bell
    c.poly([[-8, 28], [8, 28], [12, 40], [-12, 40]], p.metal);
    c.poly([[-12, 40], [12, 40], [10.5, 43], [-10.5, 43]], p.metalDark);
    c.ellipse(0, 39.5, 10, 2.6, p.metalDark);
  });

  part((c) => { // needle hull
    c.poly(profilePoly(hw, shipE.top, shipE.bottom), p.hullMid);
    c.poly(profilePoly(hw, shipE.top, shipE.bottom, -1, -0.25), p.hullLight);
    c.poly(profilePoly(hw, shipE.top, shipE.bottom, 0.4, 1), p.hullDark, 0.6);

    // gold nose tip and pinstripe
    c.poly(profilePoly(hw, shipE.top, -40), p.accent);
    c.poly(profilePoly(hw, shipE.top, -40, 0.4, 1), p.accentDark, 0.5);
    c.poly(profilePoly(hw, -6, -4.6), p.accent, 0.9);
    c.poly(profilePoly(hw, 26, 27.4), p.hullDark, 0.4);

    // long rose canopy
    c.poly(canopyPts(0, -34, -9, 5.8), p.metal);
    c.poly(canopyPts(0, -32.5, -10.5, 4.6), p.glassDark);
    c.poly(canopyPts(-0.4, -31.5, -13, 3.6), p.glass);
    c.ellipse(-1.6, -25, 1.1, 3.4, [1, 1, 1], 0.65);
  });

  part((c) => { // near side of the ring, in front of the hull
    const band = (a0, a1) => [
      ...arcPts(0, ry0, rx, ry, a0, a1),
      ...arcPts(0, ry0 + chord, rx, ry, a1, a0),
    ];
    c.poly(band(0, Math.PI), p.accent);
    c.poly(band(0, Math.acos(0.3)), p.accentDark, 0.55);            // shaded right
    c.poly(band(Math.acos(-0.45), Math.acos(-0.85)), [1, 0.96, 0.82], 0.35); // lit left
    c.thickLine(arcPts(0, ry0 + chord * 0.5, rx, ry, 0.15, Math.PI - 0.15), 0.9, p.accentDark, 0.5);
  });
}

/**
 * Gemini — two hulls flown as one. Twin needle fuselages joined by a bridge
 * wing, with the cockpit in a pod slung between them: the only ship with two
 * noses.
 */
const GEMINI_X = 15;
const shipF = {
  // one of the twin hulls, centred on its own axis
  hw(y) {
    if (y < -18) { const t = (y + 18) / -28; return 7 * Math.sqrt(Math.max(0, 1 - t * t)); }
    if (y < 24) return 7;
    return 7 + 1.5 * ((y - 24) / 6);
  },
  top: -46, bottom: 30,
  nozzles: [
    { x: -GEMINI_X, y: 40, lenK: 0.88, widK: 0.72, alpha: 0.9, main: true },
    { x: GEMINI_X, y: 40, lenK: 0.88, widK: 0.72, alpha: 0.9, main: true },
  ],
  exhaust: { x: 0, y: 40 },
  arcPoints: [
    [-15, -44], [15, -44], [-15, -24], [15, -24], [-22, -4], [22, -4],
    [-15, 22], [15, 22], [0, -16], [0, 8], [-32, 31], [32, 31], [-15, 39], [15, 39],
  ],
};

function drawShipF(part) {
  const p = SHIPS.F, hw = shipF.hw;
  const shift = (pts, dx) => pts.map(([x, y]) => [x + dx, y]);

  part((c) => { // outboard fins
    for (const s of [-1, 1]) {
      c.poly([[20 * s, 10], [33 * s, 30], [33 * s, 36], [20 * s, 28]], p.accent);
      c.poly([[27 * s, 21], [33 * s, 30], [33 * s, 36], [26 * s, 31]], p.accentDark, 0.85);
    }
  });

  part((c) => { // bridge wing between the hulls, in hull colour so it reads as structure
    c.poly([[-16, -9], [16, -9], [16, 11], [-16, 11]], p.hullDark);
    c.poly([[-16, 3], [16, 3], [16, 11], [-16, 11]], p.metal, 0.45);
    c.poly([[-16, -9], [16, -9], [16, -7.2], [-16, -7.2]], p.hullMid, 0.9);
  });

  for (const s of [-1, 1]) {
    const x = GEMINI_X * s;
    part((c) => { // engine bell
      c.poly(shift([[-5.5, 28], [5.5, 28], [8, 40], [-8, 40]], x), p.metal);
      c.poly(shift([[-8, 40], [8, 40], [6.5, 42.5], [-6.5, 42.5]], x), p.metalDark);
      c.ellipse(x, 39.5, 6.5, 1.9, p.metalDark);
    });

    part((c) => { // hull
      c.poly(shift(profilePoly(hw, shipF.top, shipF.bottom), x), p.hullMid);
      c.poly(shift(profilePoly(hw, shipF.top, shipF.bottom, -1, -0.25), x), p.hullLight);
      c.poly(shift(profilePoly(hw, shipF.top, shipF.bottom, 0.4, 1), x), p.hullDark, 0.6);

      // crimson nose and tail band
      c.poly(shift(profilePoly(hw, shipF.top, -30), x), p.accent);
      c.poly(shift(profilePoly(hw, shipF.top, -30, 0.4, 1), x), p.accentDark, 0.5);
      c.poly(shift(profilePoly(hw, 16, 21), x), p.accent);
      c.poly(shift(profilePoly(hw, 16, 21, 0.4, 1), x), p.accentDark, 0.5);
      c.poly(shift(profilePoly(hw, 25.6, 27), x), p.hullDark, 0.4);

      // porthole
      c.disc(x, -15, 3, p.metal);
      c.disc(x, -15, 2.2, p.glassDark);
      c.disc(x + 0.3, -14.6, 1.7, p.glass);
      c.disc(x - 0.7, -15.9, 0.7, [1, 1, 1], 0.8);
    });
  }

  part((c) => { // cockpit pod, slung between the hulls
    const pod = (y) => {
      if (y < -6) { const t = (y + 6) / -16; return 6 * Math.sqrt(Math.max(0, 1 - t * t)); }
      if (y < 6) return 6;
      return Math.max(0, 6 - 4 * ((y - 6) / 8));
    };
    c.poly(profilePoly(pod, -22, 14), p.hullMid);
    c.poly(profilePoly(pod, -22, 14, -1, -0.25), p.hullLight);
    c.poly(profilePoly(pod, -22, 14, 0.4, 1), p.hullDark, 0.6);
    c.poly(canopyPts(0, -21, -3, 4.4), p.metal);
    c.poly(canopyPts(0, -20, -4.4, 3.4), p.glassDark);
    c.poly(canopyPts(-0.3, -19.2, -7, 2.6), p.glass);
    c.ellipse(-1, -15, 0.8, 2.4, [1, 1, 1], 0.7);
  });
}

/** Points along a quadratic curve from p0 to p2, pulled toward p1. */
function bezierPts(p0, p1, p2, steps = 20) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    pts.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]);
  }
  return pts;
}

/** A four-point glint. */
function glintPts(cx, cy, r) {
  const k = r * 0.28;
  return [[cx, cy - r], [cx + k, cy - k], [cx + r, cy], [cx + k, cy + k],
    [cx, cy + r], [cx - k, cy + k], [cx - r, cy], [cx - k, cy - k]];
}

/**
 * Visitor — a flying saucer. The widest, flattest silhouette in the hangar: a
 * chrome disc ringed with lime running lights, a glass dome with its pilot
 * looking out, and an emitter underneath where the others have an engine bell.
 */
const shipG = {
  nozzles: [{ x: 0, y: 30, lenK: 0.95, widK: 1.15, alpha: 1, main: true }],
  exhaust: { x: 0, y: 30 },
  arcPoints: [
    [0, -19], [-10, -14], [10, -14], [-22, -2], [22, -2], [-40, 7], [40, 7],
    [-32, 13], [32, 13], [-16, 22], [16, 22], [0, 28],
  ],
};

function drawShipG(part) {
  const p = SHIPS.G;

  part((c) => { // underside bowl and the emitter
    c.ellipse(0, 18, 22, 8.5, p.metal);
    c.ellipse(4, 19.5, 17, 6, p.metalDark, 0.55);
    c.ellipse(0, 26, 10, 3.6, p.metalDark);
    c.ellipse(0, 25.6, 7.4, 2.2, p.accent, 0.9);
  });

  part((c) => { // glass dome, with the pilot looking out
    const dome = (y) => 13 * Math.sqrt(Math.max(0, 1 - Math.pow((y + 1) / 18, 2)));
    c.poly(profilePoly(dome, -19, -1), p.glassDark);
    c.poly(profilePoly(dome, -18, -1, -0.86, 0.72), p.glass, 0.8);
    c.ellipse(0, -6.5, 5.4, 6.2, p.alien);
    for (const s of [-1, 1]) c.ellipse(2.3 * s, -7.5, 1.7, 2.6, p.alienEye);
    c.ellipse(-5, -12.5, 2, 3.4, [1, 1, 1], 0.55);
  });

  part((c) => { // the disc
    c.ellipse(0, 7, 40, 10, p.hullMid);
    // the rim's underside, in shadow
    c.poly([...arcPts(0, 7, 40, 10, 0, Math.PI), ...arcPts(0, 5, 39, 7.5, Math.PI, 0)], p.hullDark, 0.8);
    c.ellipse(-3, 3.8, 33, 6, p.hullLight);
    c.ellipse(0, 0.8, 17, 4.2, p.hullMid);
    c.ellipse(-1.5, 0, 14, 2.8, p.hullLight, 0.7);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.1 + (0.8 * i) / 6);
      const x = Math.cos(a) * 35, y = 8.5 + Math.sin(a) * 6.4;
      c.disc(x, y, 1.9, p.accent);
      c.disc(x - 0.5, y - 0.5, 0.8, [1, 1, 1], 0.7);
    }
  });
}

/**
 * Sunjammer — a solar sail. A small white craft hanging under a great diamond
 * of champagne foil braced by two booms: widest at the top, and of all of
 * them the most at home out at the heliopause.
 */
const SAIL = { top: -50, mid: -24, bottom: 2, half: 41 };
const shipH = {
  hw(y) {
    if (y < 0) { const t = y / -12; return 9 * Math.sqrt(Math.max(0, 1 - t * t)); }
    if (y < 24) return 9;
    return 9 + 2 * ((y - 24) / 6);
  },
  top: -12, bottom: 30,
  nozzles: [{ x: 0, y: 39, lenK: 0.85, widK: 0.75, alpha: 1, main: true }],
  exhaust: { x: 0, y: 39 },
  arcPoints: [
    [0, -48], [-39, -24], [39, -24], [-20, -37], [20, -37], [-20, -11], [20, -11],
    [0, -24], [-9, 6], [9, 6], [-9, 22], [9, 22], [-11, 30], [11, 30], [0, 38],
  ],
};

function drawShipH(part) {
  const p = SHIPS.H, hw = shipH.hw;
  const { top, mid, bottom, half } = SAIL;
  const T = [0, top], R = [half, mid], B = [0, bottom], L = [-half, mid], C = [0, mid];

  part((c) => { // rigging, the sail, and the booms that hold it flat
    for (const s of [-1, 1]) c.thickLine([[half * s, mid], [8 * s, 9]], 0.8, p.metal);
    c.poly([T, R, B, L], p.accent);
    c.poly([T, C, L], [1, 1, 1], 0.5);
    c.poly([T, R, C], p.accentDark, 0.25);
    c.poly([L, C, B], p.accentDark, 0.4);
    c.poly([C, R, B], p.accentDark, 0.7);
    // iridescent sheen, so it reads as foil rather than canvas
    c.thickLine([[-33, -26], [-3, -46]], 1.6, hex('#7fdcff'), 0.75);
    c.thickLine([[-24, -22], [-2, -37]], 1.1, hex('#c9a8ff'), 0.6);
    c.thickLine([[5, -4], [33, -22]], 1.6, hex('#ff9fd6'), 0.7);
    c.thickLine([[4, -12], [24, -25]], 1.1, hex('#7fdcff'), 0.5);
    for (const [a, b] of [[T, R], [R, B], [B, L], [L, T]]) c.thickLine([a, b], 1.3, p.accentDark, 0.9);
    c.thickLine([T, B], 1.4, p.metal);
    c.thickLine([L, R], 1.4, p.metal);
  });

  part((c) => { // ion engine
    c.poly([[-6, 28], [6, 28], [9, 38], [-9, 38]], p.metal);
    c.poly([[-9, 38], [9, 38], [7.5, 40.5], [-7.5, 40.5]], p.metalDark);
    c.ellipse(0, 37.6, 7.5, 2.1, p.metalDark);
    c.ellipse(0, 37.6, 4.6, 1.2, p.glass, 0.75);
  });

  part((c) => { // the craft
    c.poly(profilePoly(hw, shipH.top, shipH.bottom), p.hullMid);
    c.poly(profilePoly(hw, shipH.top, shipH.bottom, -1, -0.25), p.hullLight);
    c.poly(profilePoly(hw, shipH.top, shipH.bottom, 0.4, 1), p.hullDark, 0.6);
    c.poly(profilePoly(hw, 14, 17.5), p.accentDark);
    c.poly(profilePoly(hw, 24.6, 26), p.hullDark, 0.4);
    c.disc(0, 3, 4.6, p.metal);
    c.disc(0, 3, 3.5, p.glassDark);
    c.disc(0.4, 3.5, 2.8, p.glass);
    c.disc(-1.1, 1.9, 1, [1, 1, 1], 0.8);
  });
}

/**
 * Pioneer — a heavy lifter stacked in stages. Escape tower, capsule, then
 * each stage wider than the one above it, in a black and white roll pattern:
 * the only silhouette that steps out on its way down.
 */
const shipI = {
  hw: lerpProfile([
    [-36, 1], [-34, 3], [-26, 8], [-10, 8], [-5, 12.5], [12, 12.5], [14.5, 15.5], [30, 15.5],
  ]),
  top: -36, bottom: 30,
  nozzles: [
    { x: 0, y: 39, lenK: 1, widK: 0.85, alpha: 0.85, main: true },
    { x: -9.5, y: 37, lenK: 0.75, widK: 0.5, alpha: 0.75, main: false },
    { x: 9.5, y: 37, lenK: 0.75, widK: 0.5, alpha: 0.75, main: false },
  ],
  exhaust: { x: 0, y: 39 },
  arcPoints: [
    [0, -47], [0, -38], [-6, -30], [6, -30], [-8, -18], [8, -18], [-12, -4], [12, -4],
    [-12.5, 8], [12.5, 8], [-15.5, 20], [15.5, 20], [-23, 32], [23, 32], [-9, 37], [9, 37],
  ],
};

function drawShipI(part) {
  const p = SHIPS.I, hw = shipI.hw;

  part((c) => { // escape tower: a truss up to a little motor
    for (const s of [-1, 1]) c.thickLine([[3 * s, -36], [0, -43.5]], 1.1, p.tower);
    c.thickLine([[0, -36], [0, -44]], 1.3, p.towerDark);
    c.poly([[0, -49], [2, -46], [2, -43.5], [-2, -43.5], [-2, -46]], p.tower);
  });

  part((c) => { // base fins
    for (const s of [-1, 1]) {
      c.poly([[15 * s, 15], [23 * s, 29], [23 * s, 34], [15 * s, 30]], p.hullDark);
      c.poly([[19 * s, 22], [23 * s, 29], [23 * s, 34], [19 * s, 31]], p.accent, 0.85);
    }
  });

  part((c) => { // engine cluster
    for (const x of [-9.5, 9.5]) {
      c.poly([[x - 4, 30], [x + 4, 30], [x + 5.5, 37], [x - 5.5, 37]], p.metal);
      c.ellipse(x, 36.7, 5.2, 1.6, p.metalDark);
    }
    c.poly([[-5.5, 30], [5.5, 30], [8, 39], [-8, 39]], p.metal);
    c.poly([[-8, 39], [8, 39], [6.6, 41.4], [-6.6, 41.4]], p.metalDark);
    c.ellipse(0, 38.6, 7.6, 2.2, p.metalDark);
  });

  part((c) => { // the stack
    c.poly(profilePoly(hw, shipI.top, shipI.bottom), p.hullMid);
    c.poly(profilePoly(hw, shipI.top, shipI.bottom, -1, -0.3), p.hullLight);
    c.poly(profilePoly(hw, shipI.top, shipI.bottom, 0.4, 1), p.hullDark, 0.55);

    // silver capsule cone and its heat shield
    c.poly(profilePoly(hw, shipI.top, -26), p.hullDark);
    c.poly(profilePoly(hw, shipI.top, -26, -1, -0.3), p.hullMid, 0.8);
    c.poly(profilePoly(hw, -27, -26), p.metal, 0.8);

    // roll pattern: a checker on the service module, a band on the second
    // stage, and stripes round the foot of the first
    c.poly(profilePoly(hw, -22, -16, -1, 0), p.accent);
    c.poly(profilePoly(hw, -16, -10, 0, 1), p.accent);
    c.poly(profilePoly(hw, -5, -1.5), p.accent);
    c.poly(profilePoly(hw, 12, 15.5), p.accent);
    for (const [a, b] of [[-1, -0.5], [0, 0.5]]) c.poly(profilePoly(hw, 22, 30, a, b), p.accent);

    // the capsule window
    c.disc(0, -30, 1.6, p.glassDark);
    c.disc(0.2, -29.8, 1.1, p.glass);
  });
}

/**
 * Junker — bolted together from whatever was lying around. The only ship that
 * is not symmetrical: a big engine pod on one side and a small one on the
 * other, a patched and lopsided hull, an off-centre cockpit and a crane arm.
 */
const shipJ = {
  nozzles: [
    { x: -17, y: 40, lenK: 0.95, widK: 0.8, alpha: 0.95, main: true },
    { x: 17, y: 37, lenK: 0.6, widK: 0.48, alpha: 0.9, main: false },
  ],
  exhaust: { x: -6, y: 39 },
  arcPoints: [
    [5, -44], [-6, -40], [12, -34], [-12, -20], [14, -12], [28, -38], [28, -30],
    [-25, 0], [-13, 6], [16, 10], [-25, 28], [-9, 24], [9, 25], [21, 22], [-17, 39], [17, 36],
  ],
};

function drawShipJ(part) {
  const p = SHIPS.J;
  const pod = (cx, yTop, yBot, r) => {
    const hw = (y) => (y < yTop + r ? r * Math.sqrt(Math.max(0, 1 - Math.pow((y - yTop - r) / r, 2))) : r);
    return (from = -1, to = 1) => profilePoly(hw, yTop, yBot, from, to).map(([x, y]) => [x + cx, y]);
  };

  part((c) => { // crane arm off the starboard shoulder, with its hook
    c.thickLine([[10, -28], [28, -40]], 2.2, p.metal);
    c.disc(28, -40, 2, p.metalDark);
    c.thickLine([[28, -40], [28, -31]], 0.8, p.metalDark);
    c.poly([[26, -31], [30, -31], [30, -28.5], [28, -27], [26, -28.5]], p.accentDark);
  });

  part((c) => { // small engine pod, starboard
    const shape = pod(17, 6, 30, 5);
    c.poly(shape(), p.metal);
    c.poly(shape(-1, -0.3), p.hullDark, 0.5);
    c.poly([[13, 30], [21, 30], [22, 36], [12, 36]], p.metalDark);
    c.ellipse(17, 35.7, 5, 1.5, p.metalDark);
  });

  part((c) => { // big engine pod, port, in a different metal
    const shape = pod(-17, -8, 31, 8);
    c.poly(shape(), p.hullMid);
    c.poly(shape(-1, -0.3), p.hullLight, 0.9);
    c.poly(shape(0.4, 1), p.hullDark, 0.6);
    c.poly([[-24, 6], [-10, 6], [-10, 8.5], [-24, 8.5]], p.metal, 0.9);
    c.poly([[-22.5, 31], [-11.5, 31], [-10, 40], [-24, 40]], p.metal);
    c.ellipse(-17, 39.6, 7, 2, p.metalDark);
  });

  part((c) => { // the hull: boxy, lopsided, and patched
    const hull = [[-6, -42], [5, -45], [12, -36], [14, -14], [16, 16], [9, 27],
      [-9, 26], [-13, 4], [-12, -22], [-9, -36]];
    c.poly(hull, p.hullMid);
    c.poly([[-9, -36], [-12, -22], [-13, 4], [-9, 26], [-4, 26], [-8, 4], [-7, -22], [-5, -36]], p.hullLight, 0.7);
    c.poly([[12, -36], [14, -14], [16, 16], [9, 27], [5, 26], [11, 16], [9, -14], [8, -36]], p.hullDark, 0.6);
    // a nose cap off some other ship
    c.poly([[-6, -42], [5, -45], [12, -36], [9, -33], [0, -34], [-9, -36]], p.metal);
    // plate seams and rivets
    c.thickLine([[-12, -14], [13, -18]], 0.8, p.hullDark, 0.7);
    c.thickLine([[-13, 12], [15, 9]], 0.8, p.hullDark, 0.7);
    for (const [x, y] of [[-9, -14.6], [-1, -15.9], [7, -17], [-9, 11.6], [0, 10.6], [9, 9.7]]) {
      c.disc(x, y + 1.6, 0.7, p.hullDark, 0.8);
    }
    // the teal patch, riveted on
    c.poly([[1, -6], [12, -8], [13, 6], [2, 8]], p.accent);
    c.poly([[8, -7], [12, -8], [13, 6], [9, 7]], p.accentDark, 0.5);
    for (const [x, y] of [[2.5, -4], [10.6, -5.6], [11.4, 3.8], [3.4, 5.4]]) c.disc(x, y, 0.6, p.hullLight, 0.9);
    // off-centre cockpit lamp
    c.disc(-3, -23, 5.2, p.metal);
    c.disc(-3, -23, 4, p.glassDark);
    c.disc(-2.6, -22.5, 3.2, p.glass);
    c.disc(-4.2, -24.4, 1.1, [1, 1, 1], 0.8);
    // soot where the port engine runs hot
    c.ellipse(-8, 20, 4, 5, p.hullDark, 0.45);
  });
}

/**
 * Manta — a flying wing. No fins and hardly any fuselage: a broad curved wing
 * with its tips swept down and two horns at the front, like the ray it is
 * named for.
 */
const shipK = {
  nozzles: [
    { x: -8, y: 32, lenK: 0.8, widK: 0.6, alpha: 0.85, main: true },
    { x: 8, y: 32, lenK: 0.8, widK: 0.6, alpha: 0.85, main: true },
  ],
  exhaust: { x: 0, y: 32 },
  arcPoints: [
    [-10, -40], [10, -40], [0, -28], [-18, -16], [18, -16], [-32, -2], [32, -2],
    [-42, 14], [42, 14], [-22, 14], [22, 14], [-10, 24], [10, 24], [-8, 31], [8, 31],
  ],
};

function drawShipK(part) {
  const p = SHIPS.K;
  const lead = (s) => bezierPts([5 * s, -26], [31 * s, -23], [42 * s, 14]);
  const trail = (s) => bezierPts([42 * s, 14], [23 * s, 9], [9 * s, 26]);

  part((c) => { // the horns, curling forward either side of the mouth
    for (const s of [-1, 1]) {
      c.poly([
        ...bezierPts([3 * s, -25], [4 * s, -38], [11 * s, -42]),
        ...bezierPts([12.5 * s, -38], [9 * s, -33], [9.5 * s, -24]),
      ], p.hullDark);
      c.thickLine(bezierPts([4.5 * s, -27], [5.5 * s, -36], [10 * s, -40], 10), 0.8, p.hullLight, 0.6);
    }
  });

  part((c) => { // twin engines tucked under the trailing edge
    for (const s of [-1, 1]) {
      const x = 8 * s;
      c.poly([[x - 4, 23], [x + 4, 23], [x + 5, 31], [x - 5, 31]], p.metal);
      c.ellipse(x, 30.8, 5, 1.6, p.metalDark);
    }
  });

  part((c) => { // the wing, body and all
    const outline = [
      [0, -28], ...lead(1), ...trail(1).slice(1), [0, 28],
      ...trail(-1).reverse().slice(0, -1), ...lead(-1).reverse(),
    ];
    c.poly(outline, p.hullMid);
    c.ellipse(0, -2, 9, 25, p.hullLight, 0.4);
    for (const s of [-1, 1]) {
      c.thickLine(bezierPts([6 * s, -23], [29 * s, -20], [39 * s, 12]), 2.4, p.hullLight, 0.6);
      c.thickLine(trail(s), 3, p.hullDark, 0.75);
      c.thickLine(trail(s).slice(0, 9), 1, p.accent, 0.85);
      // pale shoulder marks
      c.poly([[10 * s, -12], [24 * s, -9], [29 * s, 0], [14 * s, -4]], p.marks, 0.85);
      c.disc(40 * s, 12, 1.9, p.accent);
      c.disc(40 * s - 0.4 * s, 11.5, 0.8, [1, 1, 1], 0.7);
      // eyes, low on the head
      c.ellipse(3.2 * s, -20, 1.7, 2.7, p.glassDark);
      c.ellipse(3.2 * s, -20.4, 1.1, 1.9, p.glass);
    }
  });
}

/**
 * Prism — a crystal ship. A great faceted gem held up in gold claws on a
 * slender pearl body, with an exhaust that splits into colours like light
 * through glass.
 */
const GEM = {
  A: [0, -50], B: [16, -40], C: [16, -24], D: [0, -14], E: [-16, -24], F: [-16, -40],
  G: [-6, -38], H: [6, -38], I: [6, -23], J: [-6, -23],
};
const shipL = {
  hw(y) { // the pearl body under the gem
    if (y < 0) return 4 + 4 * ((y + 16) / 16);
    if (y < 24) return 8;
    return 8 + 2 * ((y - 24) / 6);
  },
  top: -16, bottom: 30,
  nozzles: [
    { x: -5, y: 40, lenK: 1, widK: 0.42, alpha: 0.85, main: false, pal: PRISM_BEAMS.red },
    { x: 0, y: 40, lenK: 1.06, widK: 0.42, alpha: 0.85, main: true, pal: PRISM_BEAMS.green },
    { x: 5, y: 40, lenK: 1, widK: 0.42, alpha: 0.85, main: false, pal: PRISM_BEAMS.violet },
  ],
  exhaust: { x: 0, y: 40 },
  arcPoints: [
    [0, -49], [-16, -40], [16, -40], [-16, -24], [16, -24], [0, -15], [-18, -24], [18, -24],
    [-8, 0], [8, 0], [-18, 26], [18, 26], [-8, 24], [8, 24], [0, 39],
  ],
};

function drawShipL(part) {
  const p = SHIPS.L, f = p.facets, hw = shipL.hw;
  const { A, B, C, D, E, F, G, H, I, J } = GEM;

  part((c) => { // swept fins round the base, gold on the leading edge
    for (const s of [-1, 1]) {
      c.poly([[8 * s, 10], [19 * s, 26], [18 * s, 33], [8 * s, 28]], p.hullMid);
      c.poly([[8 * s, 10], [19 * s, 26], [18 * s, 27.6], [7.4 * s, 12]], p.accent);
      c.poly([[14 * s, 22], [19 * s, 26], [18 * s, 33], [12 * s, 30]], p.hullDark, 0.55);
    }
  });

  part((c) => { // engine bell
    c.poly([[-7, 28], [7, 28], [10.5, 40], [-10.5, 40]], p.metal);
    c.poly([[-10.5, 40], [10.5, 40], [9, 42.5], [-9, 42.5]], p.metalDark);
    c.ellipse(0, 39.6, 9, 2.4, p.metalDark);
  });

  part((c) => { // pearl body
    c.poly(profilePoly(hw, shipL.top, shipL.bottom), p.hullMid);
    c.poly(profilePoly(hw, shipL.top, shipL.bottom, -1, -0.25), p.hullLight);
    c.poly(profilePoly(hw, shipL.top, shipL.bottom, 0.4, 1), p.hullDark, 0.55);
    c.poly(profilePoly(hw, 6, 8), p.accent);
    c.poly(profilePoly(hw, 25, 26.5), p.hullDark, 0.4);
  });

  part((c) => { // the crystal, cut into facets that each catch a different colour
    c.poly([A, H, G], f.top);
    c.poly([A, G, F], f.cyan);
    c.poly([A, B, H], f.violet);
    c.poly([F, G, J, E], f.blue);
    c.poly([G, H, I, J], f.pale);
    c.poly([H, B, C, I], f.pink);
    c.poly([E, J, D], f.green);
    c.poly([I, C, D], f.gold);
    c.poly([J, I, D], f.top);
    for (const [a, b] of [[A, G], [A, H], [G, H], [G, J], [H, I], [J, I], [F, G], [H, B],
      [E, J], [I, C], [J, D], [I, D]]) {
      c.thickLine([a, b], 0.6, [1, 1, 1], 0.55);
    }
    c.poly(glintPts(-8, -42, 3.2), [1, 1, 1], 0.95);
    c.poly(glintPts(9, -28, 2.2), [1, 1, 1], 0.8);
  });

  part((c) => { // gold claws gripping it from below
    for (const s of [-1, 1]) {
      c.thickLine([[5 * s, -10], [14 * s, -16], [18 * s, -26], [16.5 * s, -31]], 2.4, p.accent);
      c.thickLine([[6 * s, -9.4], [14.6 * s, -15], [18.6 * s, -25]], 0.8, p.accentDark, 0.6);
    }
  });
}

const SHIP_DEF = {
  A: { geo: shipA, draw: drawShipA, pal: SHIPS.A },
  B: { geo: shipB, draw: drawShipB, pal: SHIPS.B },
  C: { geo: shipC, draw: drawShipC, pal: SHIPS.C },
  D: { geo: shipD, draw: drawShipD, pal: SHIPS.D },
  E: { geo: shipE, draw: drawShipE, pal: SHIPS.E },
  F: { geo: shipF, draw: drawShipF, pal: SHIPS.F },
  G: { geo: shipG, draw: drawShipG, pal: SHIPS.G },
  H: { geo: shipH, draw: drawShipH, pal: SHIPS.H },
  I: { geo: shipI, draw: drawShipI, pal: SHIPS.I },
  J: { geo: shipJ, draw: drawShipJ, pal: SHIPS.J },
  K: { geo: shipK, draw: drawShipK, pal: SHIPS.K },
  L: { geo: shipL, draw: drawShipL, pal: SHIPS.L },
};

/* ------------------------------------------------------------------ *
 * Flame
 * ------------------------------------------------------------------ */

// Speed tiers: the plume gets longer, wider and hotter as speed climbs.
const TIERS = [
  { len: 16, wid: 8, diamonds: 0, sparks: 0, whiteCore: false, glow: 0.35 },
  { len: 30, wid: 11, diamonds: 0, sparks: 3, whiteCore: false, glow: 0.5 },
  { len: 46, wid: 14, diamonds: 2, sparks: 6, whiteCore: false, glow: 0.65 },
  { len: 64, wid: 17, diamonds: 3, sparks: 11, whiteCore: true, glow: 0.85 },
  { len: 82, wid: 21, diamonds: 4, sparks: 18, whiteCore: true, glow: 1.0 },
];

/**
 * One plume, drawn into `c`. Layered widest-and-coolest to
 * narrowest-and-hottest, all additive, so overlaps blow out to white.
 */
function drawPlume(c, ox, oy, len, wid, pal, noise, seedPhase, opts = {}) {
  const { diamonds = 0, whiteCore = false, scale = 1, alpha = 1 } = opts;
  const L = len * scale, W = wid * scale;

  // half-width along the plume, s from 0 (nozzle) to 1 (tip)
  const hwAt = (s) => {
    const base = Math.pow(Math.max(0, 1 - Math.pow(s, 1.7)), 0.55);
    const bulge = 1 + 0.22 * Math.sin(Math.min(1, s * 1.6) * Math.PI);
    const flick = 1 + 0.16 * noise(s * 5 + seedPhase) * Math.min(1, s * 3);
    return W * base * bulge * flick;
  };

  const shell = (k, sMax, color, a) => {
    const pts = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const s = (sMax * i) / steps;
      pts.push([ox - hwAt(s) * k, oy + s * L]);
    }
    for (let i = steps; i >= 0; i--) {
      const s = (sMax * i) / steps;
      pts.push([ox + hwAt(s) * k, oy + s * L]);
    }
    c.poly(pts, color, a * alpha, 'add');
  };

  // nozzle glow hides the seam where the sprite meets the engine bell
  c.softDisc(ox, oy + W * 0.15, W * 1.5, pal.inner, 0.45 * alpha, 2, 'add');

  // Additive layers saturate, so the alphas are tuned to land the shells on
  // deep-orange -> orange -> amber -> near-white rather than blowing the whole
  // plume out to a white blob.
  shell(1.55, 1.0, pal.outer, 0.42);
  shell(1.0, 1.0, pal.mid, 0.46);
  shell(0.58, 0.86, pal.inner, 0.40);
  shell(0.28, 0.62, pal.core, 0.38);
  if (whiteCore) shell(0.12, 0.40, pal.hot, 0.5);

  // mach diamonds in the supersonic core
  for (let i = 0; i < diamonds; i++) {
    const s = 0.1 + i * 0.15;
    const r = W * (0.26 - i * 0.04);
    if (r <= 0) continue;
    c.softDisc(ox, oy + s * L, r * 2.2, pal.core, 0.3 * alpha, 2.2, 'add');
    c.poly([
      [ox, oy + s * L - r * 1.5], [ox + r, oy + s * L],
      [ox, oy + s * L + r * 1.5], [ox - r, oy + s * L],
    ], pal.hot, 0.45 * alpha, 'add');
  }
}

function drawSparks(c, ox, oy, len, wid, pal, rnd, count, alpha = 1) {
  for (let i = 0; i < count; i++) {
    const s = 0.25 + rnd() * 0.95;
    const x = ox + (rnd() - 0.5) * wid * (0.8 + s * 1.8);
    const y = oy + s * len;
    const r = 0.7 + rnd() * 1.5;
    // A palette can name its own spark colours; one draw either way, so every
    // existing sheet keeps its exact random sequence.
    const col = pal.sparks
      ? pal.sparks[Math.floor(rnd() * pal.sparks.length)]
      : rnd() > 0.55 ? pal.hot : pal.inner;
    c.softDisc(x, y, r * 2.2, col, 0.5 * alpha, 2, 'add');
    c.disc(x, y, r, col, 0.9 * alpha, 'add');
  }
}

/* ------------------------------------------------------------------ *
 * Cell rendering
 * ------------------------------------------------------------------ */

const CELL = { w: 96, h: 176, ax: 48, ay: 52 };   // ship / thruster / arc frames
const BIG = { w: 192, h: 224, ax: 96, ay: 52 };   // blastoff frames

/** Render the ship art, each part carrying its own dark keyline. */
function renderShip(which) {
  const { L, spec } = newCell(CELL);
  const art = new Layer(L.w, L.h);
  const r = Math.round(1.5 * SS);

  const part = (fn) => {
    const piece = new Layer(L.w, L.h);
    fn(new Ctx(piece, spec.ax, spec.ay));
    const mask = dilateAlpha(piece, r);
    const outlined = new Layer(L.w, L.h);
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        const a = mask[y * L.w + x];
        if (a > 0.02) outlined.over(x, y, OUTLINE, a);
      }
    outlined.drawLayer(piece);
    art.drawLayer(outlined);
  };

  SHIP_DEF[which].draw(part);
  L.drawLayer(art);
  return { full: L, art };
}

function renderThruster(which, tier, frame) {
  const { L, c } = newCell(CELL);
  const geo = SHIP_DEF[which].geo;
  const pal = FLAME[which];
  const t = TIERS[tier];
  const seed = 9001 + tier * 71 + frame * 13 + seedOf(which);
  const rnd = mulberry32(seed);
  const noise = makeNoise(seed);
  const phase = frame * 3.7;

  // per-frame flicker keeps a 4-frame loop from looking like a still image
  const wobble = 1 + (frame % 2 === 0 ? 0.05 : -0.05) + noise(frame * 1.3) * 0.05;

  const fl = new Layer(L.w, L.h);
  const fc = new Ctx(fl, CELL.ax, CELL.ay);

  // a nozzle may carry its own flame palette, which is how one ship gets
  // plumes of different colours
  for (const n of geo.nozzles) {
    drawPlume(fc, n.x, n.y, t.len * n.lenK, t.wid * n.widK, n.pal ?? pal, noise, phase + n.x, {
      diamonds: n.main ? t.diamonds : 0,
      whiteCore: n.main && t.whiteCore,
      scale: wobble,
      alpha: n.alpha,
    });
  }
  if (t.sparks) drawSparks(fc, geo.exhaust.x, geo.exhaust.y, t.len, t.wid, pal, rnd, t.sparks);

  // wide soft halo so the plume lights up the sky around it — kept low and
  // wide, otherwise it stacks onto the core and washes the colour out
  if (t.glow > 0) L.addLayer(blur(fl, Math.round(5 * SS)), t.glow * 0.5);
  L.addLayer(fl, 1);
  return L;
}

/**
 * Electrocution overlay — drawn on top of the ship sprite while hull damage
 * has the rocket paralysed. Six frames, strobing so it never looks static.
 */
function renderArc(which, frame, shipArt) {
  const { L, c } = newCell(CELL);
  const geo = SHIP_DEF[which].geo;
  const seed = 4400 + frame * 37 + seedOf(which);
  const rnd = mulberry32(seed);
  // strobe hard between frames — a steady glow reads as "shielded", a
  // stuttering one reads as "shorting out"
  const intensity = [1, 0.35, 0.85, 0.2, 1, 0.45][frame];

  const fx = new Layer(L.w, L.h);
  const cc = new Ctx(fx, CELL.ax, CELL.ay);

  // rim discharge: the ship's own silhouette, dilated and lit up
  const dil = dilateAlpha(shipArt, Math.round(2.2 * SS));
  const rim = new Layer(L.w, L.h);
  for (let y = 0; y < L.h; y++)
    for (let x = 0; x < L.w; x++) {
      const outer = dil[y * L.w + x];
      const inner = shipArt.d[(y * L.w + x) * 4 + 3];
      const edge = Math.max(0, outer - inner);
      if (edge > 0.02) rim.add(x, y, ARC.outer, edge * 0.5 * intensity);
      // keep the body tint very light, otherwise the hull colours wash out and
      // the player can't tell which rocket is theirs
      if (inner > 0.02) rim.add(x, y, ARC.mid, inner * 0.035 * intensity);
    }
  fx.addLayer(blur(rim, Math.round(1.5 * SS)), 0.7);
  fx.addLayer(rim, 0.85);

  // arcs jumping between hull attachment points
  const pts = geo.arcPoints;
  const arcCount = 2 + Math.round(rnd() * 2 + intensity);
  for (let a = 0; a < arcCount; a++) {
    const p0 = pts[Math.floor(rnd() * pts.length)];
    const p1 = pts[Math.floor(rnd() * pts.length)];
    if (p0 === p1) continue;
    const path = jaggedPath(p0, p1, 6, 5.5, rnd);
    cc.thickLine(path, 3.4, ARC.outer, 0.4 * intensity, 'add');
    cc.thickLine(path, 1.8, ARC.mid, 0.75 * intensity, 'add');
    cc.thickLine(path, 0.8, ARC.core, 1 * intensity, 'add');

    // branch off the middle of the bolt
    if (rnd() > 0.45) {
      const mid = path[Math.floor(path.length / 2)];
      const tip = [mid[0] + (rnd() - 0.5) * 26, mid[1] + (rnd() - 0.5) * 26];
      const br = jaggedPath(mid, tip, 4, 4, rnd);
      cc.thickLine(br, 1.6, ARC.mid, 0.5 * intensity, 'add');
      cc.thickLine(br, 0.7, ARC.core, 0.8 * intensity, 'add');
    }
    for (const p of [p0, p1]) cc.softDisc(p[0], p[1], 7, ARC.mid, 0.5 * intensity, 2, 'add');
  }

  // loose sparks flying off
  for (let i = 0; i < 6 + Math.round(intensity * 8); i++) {
    const p = pts[Math.floor(rnd() * pts.length)];
    const x = p[0] + (rnd() - 0.5) * 22, y = p[1] + (rnd() - 0.5) * 22;
    cc.softDisc(x, y, 3, ARC.mid, 0.45 * intensity, 2, 'add');
    cc.disc(x, y, 0.9, ARC.core, 0.9 * intensity, 'add');
  }

  L.addLayer(blur(fx, Math.round(2.5 * SS)), 0.3 * intensity);
  L.addLayer(fx, 1);
  return L;
}

function jaggedPath(p0, p1, segments, jitter, rnd) {
  const path = [p0];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const x = p0[0] + (p1[0] - p0[0]) * t + (rnd() - 0.5) * jitter * 2;
    const y = p0[1] + (p1[1] - p0[1]) * t + (rnd() - 0.5) * jitter * 2;
    path.push([x, y]);
  }
  path.push(p1);
  return path;
}

/**
 * Blastoff — 8 frames covering the ~1.1s ignition flare, from the first spark
 * through the peak flare and billowing exhaust, settling into the cruise plume.
 */
function renderBlastoff(which, frame) {
  const { L, c } = newCell(BIG);
  const geo = SHIP_DEF[which].geo;
  const pal = FLAME[which];
  const seed = 7700 + frame * 53 + seedOf(which);
  const rnd = mulberry32(seed);
  const noise = makeNoise(seed);
  const t = frame / 7; // 0..1 through the launch

  // flare spikes hard on frame 1-2 then relaxes into the tier-4 cruise plume
  const flareCurve = [0.15, 0.85, 1.0, 0.92, 0.8, 0.7, 0.62, 0.55][frame];
  const smokeCurve = [0.0, 0.18, 0.45, 0.72, 0.92, 1.0, 0.82, 0.55][frame];
  const len = 34 + flareCurve * 96;
  const wid = 10 + flareCurve * 20;

  // ---- exhaust cloud, behind the flame ----
  // Built as billowing lobes rolling outward from the pad: each lobe is a
  // cluster of overlapping soft discs, which gives the cauliflower edge a
  // scatter of loose puffs never produces.
  const smoke = new Layer(L.w, L.h);
  const sc = new Ctx(smoke, BIG.ax, BIG.ay);
  if (smokeCurve > 0.01) {
    const base = geo.exhaust.y + 20;
    const puffs = [];

    // two arms rolling outward from the pad
    const ARMS = 4;
    for (const side of [-1, 1]) {
      for (let l = 0; l < ARMS; l++) {
        const f = (l + 0.5) / ARMS;                       // 0..1 outward
        const armX = side * smokeCurve * (14 + f * 52) * (0.85 + rnd() * 0.3);
        const armY = base + 12 - f * smokeCurve * 20;     // curls up as it rolls
        const R = (12 + f * 10) * (0.5 + smokeCurve * 0.9);
        for (let i = 0; i < 9; i++) {
          const a2 = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * R * 0.85;
          puffs.push({
            x: armX + Math.cos(a2) * rr,
            y: armY + Math.sin(a2) * rr * 0.85,
            r: R * (0.42 + rnd() * 0.45),
            shade: 0.7 + rnd() * 0.55,
          });
        }
      }
    }
    // dense column boiling out directly under the nozzle
    for (let i = 0; i < 16; i++) {
      const a2 = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd()) * 30 * (0.5 + smokeCurve);
      puffs.push({
        x: Math.cos(a2) * rr,
        y: base + 12 + Math.sin(a2) * rr * 0.7,
        r: 10 + rnd() * 12,
        shade: 0.9 + rnd() * 0.5,
      });
    }

    // biggest first so the small crisp puffs land on top and keep the edge legible
    puffs.sort((a, b) => b.r - a.r);
    for (const pf of puffs) {
      const heat = Math.max(0, 1 - Math.hypot(pf.x, pf.y - base) / 58);
      const col = [
        Math.min(1, (0.5 + heat * 0.5) * pf.shade),
        Math.min(1, (0.52 + heat * 0.2) * pf.shade),
        Math.min(1, (0.62 - heat * 0.25) * pf.shade),
      ];
      // near-solid discs (low falloff exponent) — a soft falloff here just
      // averages the whole cloud into a flat fog bank
      sc.softDisc(pf.x, pf.y, pf.r, col, 0.4 * smokeCurve * (1 - t * 0.35), 0.55, 'over');
    }
  }
  L.drawLayer(blur(smoke, Math.max(1, Math.round(0.6 * SS))), 1);

  // ---- flare ----
  const fl = new Layer(L.w, L.h);
  const fc = new Ctx(fl, BIG.ax, BIG.ay);

  // ignition flash on the first frame
  if (frame === 0) {
    fc.softDisc(geo.exhaust.x, geo.exhaust.y + 4, 30, pal.hot, 0.9, 2, 'add');
    fc.softDisc(geo.exhaust.x, geo.exhaust.y + 4, 54, pal.inner, 0.35, 2.5, 'add');
  }

  for (const n of geo.nozzles) {
    drawPlume(fc, n.x, n.y, len * n.lenK, wid * n.widK, n.pal ?? pal, noise, frame * 4.1 + n.x, {
      diamonds: n.main ? (frame >= 2 ? 4 : 2) : 0,
      whiteCore: n.main || frame < 4,
      alpha: n.alpha,
    });
  }

  // debris and sparks kicked out by the launch
  drawSparks(fc, geo.exhaust.x, geo.exhaust.y, len, wid, pal, rnd, 26 - frame * 2);
  const streaks = Math.round(14 * (1 - t * 0.6));
  for (let i = 0; i < streaks; i++) {
    const ang = (rnd() * Math.PI * 0.9) + Math.PI * 0.05;
    const dist = 20 + rnd() * 70 * (0.3 + smokeCurve);
    const x = geo.exhaust.x + Math.cos(ang) * dist * (rnd() > 0.5 ? 1 : -1);
    const y = geo.exhaust.y + Math.sin(ang) * dist * 0.5 + 6;
    const l = 3 + rnd() * 9;
    fc.thickLine([[x, y], [x + (x > 0 ? l : -l), y + l * 0.5]], 1.6,
      rnd() > 0.5 ? pal.hot : pal.inner, 0.8, 'add');
  }

  L.addLayer(blur(fl, Math.round(4 * SS)), 1.5 * (0.5 + flareCurve));
  L.addLayer(fl, 1);
  return L;
}

/* ------------------------------------------------------------------ *
 * Sheet assembly — one self-contained sheet per rocket
 * ------------------------------------------------------------------ */

// The roster. Adding a rocket is: define its geometry + draw fn above, add it
// to SHIP_DEF, then add a line here. It gets its own PNG; no existing sheet is
// re-laid-out, so cached art for other rockets stays valid.
const ROSTER = [
  { key: 'A', id: 'vanguard', label: 'Vanguard' },
  { key: 'B', id: 'kestrel', label: 'Kestrel' },
  { key: 'C', id: 'marauder', label: 'Marauder' },
  { key: 'D', id: 'bulwark', label: 'Bulwark' },
  { key: 'E', id: 'halcyon', label: 'Halcyon' },
  { key: 'F', id: 'gemini', label: 'Gemini' },
  { key: 'G', id: 'visitor', label: 'Visitor' },
  { key: 'H', id: 'sunjammer', label: 'Sunjammer' },
  { key: 'I', id: 'pioneer', label: 'Pioneer' },
  { key: 'J', id: 'junker', label: 'Junker' },
  { key: 'K', id: 'manta', label: 'Manta' },
  { key: 'L', id: 'prism', label: 'Prism' },
];

/**
 * Frame names are unqualified (`ship`, `thrust_t3_1`, `zap_0`, `blastoff_5`)
 * because the file already identifies the rocket. Every rocket therefore
 * exposes exactly the same animation names, so the loader and the render code
 * never branch on which rocket it is.
 */
function buildRocket({ key, id, label }) {
  const frames = {};
  const animations = {};
  const small = [];   // CELL-sized frames
  const big = [];     // BIG-sized frames

  const { full, art } = renderShip(key);
  small.push({ name: 'ship', layer: full });
  animations.ship = { frames: ['ship'] };

  for (let tier = 0; tier < TIERS.length; tier++) {
    const names = [];
    for (let f = 0; f < 4; f++) {
      const name = `thrust_t${tier}_${f}`;
      small.push({ name, layer: renderThruster(key, tier, f) });
      names.push(name);
    }
    animations[`thrust_t${tier}`] = { frames: names, fps: 24, loop: true };
  }

  {
    const names = [];
    for (let f = 0; f < 6; f++) {
      const name = `zap_${f}`;
      small.push({ name, layer: renderArc(key, f, art) });
      names.push(name);
    }
    animations.zap = { frames: names, fps: 18, loop: true };
  }

  {
    const names = [];
    for (let f = 0; f < 8; f++) {
      const name = `blastoff_${f}`;
      big.push({ name, layer: renderBlastoff(key, f) });
      names.push(name);
    }
    animations.blastoff = { frames: names, fps: 7, loop: false };
  }

  // pack: small cells in an 8-wide grid up top, big cells in a 4-wide grid below
  const packed = packSections([
    { cols: 8, spec: CELL, cells: small },
    { cols: 4, spec: BIG, cells: big },
  ]);
  const { sheet, size } = packed;
  Object.assign(frames, packed.frames);

  const atlas = {
    id,
    label,
    image: `${id}.png`,
    note: 'Draw at (shipX - ax, shipY - ay). Every frame shares the ship-centre anchor, so thruster/zap/blastoff frames line up with the ship frame at the same position.',
    size,
    tiers: TIERS.length,
    frames,
    animations,
  };

  return { atlas, sheet, count: small.length + big.length };
}

/* ------------------------------------------------------------------ *
 * Write
 * ------------------------------------------------------------------ */

const atlases = {};

for (const entry of ROSTER) {
  console.log(`drawing ${entry.id}…`);
  const { atlas, sheet, count } = buildRocket(entry);
  const bytes = writeSheet(OUT_DIR, entry.id, sheet, atlas);
  atlases[entry.id] = atlas;
  console.log(
    `  ${entry.id}.png  ${atlas.size.w}×${atlas.size.h}  ` +
    `${count} frames  ${(bytes / 1024).toFixed(0)} KB`
  );
}

// Roster index — the lobby reads this to know what exists, then loads only the
// sheets for the rockets actually in the race.
const index = {
  rockets: ROSTER.map(({ id, label }) => ({
    id, label, atlas: `${id}.json`, image: `${id}.png`,
  })),
};
fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2));

// Every atlas as a plain global too, so preview.html can run straight off the
// filesystem — fetch() is blocked under file://.
writeAtlasGlobal(OUT_DIR, 'atlas.js', {
  ROCKET_INDEX: index,
  ROCKET_ATLASES: atlases,
}, 'gen-rockets.mjs');

console.log(`wrote ${ROSTER.length} rockets + index.json, atlas.js`);
