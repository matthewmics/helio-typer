# Rocket spritesheets

**One sheet per rocket.** Each is 768×1152 RGBA, ~460KB, 35 frames, and fully
self-contained — hull, its own thrusters, its own zap, its own blastoff.

Generated, not hand-drawn:

```
node assets/rockets/gen-rockets.mjs
```

No dependencies and no build step (software rasteriser + raw PNG encoder over
`node:zlib`), same as the rest of the prototype. Everything is written into this
folder, next to the generator.

Open `preview.html` directly in a browser to flip through everything with a
speed slider, a hull-breach button and a blast-off button. No server needed.

Files, all in `assets/rockets/`:

| File | What it is |
|---|---|
| `vanguard.png` / `.json` | one rocket: sheet + frame rects + animations |
| `kestrel.png` / `.json` | " |
| `marauder.png` / `.json` | " |
| `bulwark.png` / `.json` | " |
| `halcyon.png` / `.json` | " |
| `gemini.png` / `.json` | " |
| `visitor.png` / `.json` | " |
| `sunjammer.png` / `.json` | " |
| `pioneer.png` / `.json` | " |
| `junker.png` / `.json` | " |
| `manta.png` / `.json` | " |
| `prism.png` / `.json` | " |
| `index.json` | the roster — what rockets exist |
| `atlas.js` | every atlas as `window.ROCKET_ATLASES`, for `file://` loading |
| `gen-rockets.mjs` | the generator — this is the source of truth for the art |
| `preview.html` | animated viewer |

## Why one file per rocket

A single combined sheet costs ~1040px of height per rocket, so it would have
crossed the **4096×4096 max texture size** — the common floor on mobile GPUs —
at rocket #4. Packing squarer only moves that wall to ~20.

The bigger reason is loading: a race has 2–8 rockets in it, but a combined sheet
makes every player download every skin's art for every race. Per-rocket files
mean the lobby reads `index.json`, then fetches only the sheets for the
rockets actually in the room.

It also means adding a rocket never re-lays-out an existing sheet, so you don't
cache-bust every skin because you added one.

## Adding a rocket

1. Add a geometry object (`hw` profile, `nozzles`, `exhaust`, `arcPoints`) next
   to `shipA` through `shipL`.
2. Add a `drawShipX(part)` function — see the `part()` note under *Tweaking*.
3. Register it in `SHIP_DEF`, and add a `SHIPS` + `FLAME` palette entry.
4. Add one line to `ROSTER`.

**Hull shape.** Curved hulls use a `sqrt` half-width function (Vanguard,
Kestrel); faceted ones use `lerpProfile([[y, halfWidth], …])`, whose straight
segments survive sampling instead of getting rounded off (Marauder).

**Engines.** `nozzles` is a list, so a ship can have any arrangement:

```js
nozzles: [
  { x: 0, y: 38, lenK: 1, widK: 1, alpha: 1, main: true },   // Vanguard: one
  { x: -19, y: 37, lenK: 0.52, widK: 0.5, alpha: 0.95 },     // Kestrel: + boosters
]
exhaust: { x: 0, y: 38 }   // where the blastoff cloud, flash and sparks radiate from
```

`main` nozzles get the mach diamonds and the white-hot core. If two plumes
overlap, drop their `alpha` — the blending is additive, so overlapping plumes at
full alpha sum to flat white and throw away the ship's exhaust colour. That's
why the Marauder's twin engines sit at `0.78`.

Two optional extras, both unused by the first six ships:

- A nozzle can carry its own flame palette as `pal`, overriding the ship's
  `FLAME` entry for that one plume. Prism uses this for its three coloured
  beams.
- A `FLAME` palette can list `sparks`, an array of colours its sparks are drawn
  from instead of its hot and inner tones.

Rerun the generator. You get `<id>.png` + `<id>.json`, and the index picks it up
automatically. Nothing else changes — existing sheets are byte-identical.

Frame names inside a sheet are **unqualified** (`ship`, `thrust_t3_1`, `zap_0`,
`blastoff_5`) because the file already identifies the rocket. Every rocket
exposes exactly the same animation names, so render code never branches on which
rocket it's drawing.

---

## The roster

**Vanguard (`A`)** — the classic: cream hull, red nose cap and swept fins, blue
porthole, single engine. Warm **orange** exhaust.

**Kestrel (`B`)** — a clean interceptor: narrow fuselage with a long graphite
nose, two strapped side boosters with teal cones, winglets outboard of them,
amber hex canopy. Cool **blue** exhaust, three plumes.

**Marauder (`C`)** — the aggressive one, built as a deliberate inversion of the
other two: a faceted straight-line hull instead of curved profiles, dark
gunmetal instead of pale cream, a hostile visor slit instead of a round
porthole, forward barbs, huge raked scythe wings, and twin engines. Violent
**violet** exhaust, two full plumes.

**Bulwark (`D`)**: a heavy lander, short and wide where the others are tall
and narrow. Glass dome cockpit with an antenna, olive armoured hab with a
hazard-striped band, RCS pods on the flanks, landing legs splayed out past the
hull, and a main engine between two verniers. **Gold** exhaust, three plumes.

**Halcyon (`E`)**: a slender jade needle threaded through a wide gold ring
wing, so it is the only silhouette with gaps in it. Gold nose tip, long rose
canopy, single engine. **Green** exhaust.

**Gemini (`F`)**: two indigo hulls flown as one, each with a crimson nose and
its own engine, joined by a bridge wing with the cockpit pod slung between
them. The only ship with two noses. **Crimson** exhaust, two separate plumes.

**Visitor (`G`)**: a flying saucer, the widest and flattest silhouette. Chrome
disc ringed with running lights, a glass dome with its pilot looking out, and
an emitter underneath instead of an engine bell. **Lime** exhaust, one wide
beam.

**Sunjammer (`H`)**: a solar sail. A small white craft hanging under a great
diamond of iridescent foil on two booms, so it is widest at the top. **White**
ion exhaust.

**Pioneer (`I`)**: a heavy lifter stacked in stages. Red escape tower,
capsule, then each stage wider than the one above in a black and white roll
pattern. **Indigo** exhaust, a tight cluster of three.

**Junker (`J`)**: bolted together from spare parts, and the only ship that is
not symmetrical. Big engine pod on one side, small on the other, a rusty
patched hull, an off-centre cockpit lamp and a crane arm. **Teal** exhaust,
two plumes of different sizes.

**Manta (`K`)**: a flying wing with no fins and hardly any fuselage. Broad
petrol-blue wing with its tips swept down, pale shoulder marks, and two horns
at the front. **Pink** exhaust, twin plumes.

**Prism (`L`)**: a crystal ship. A faceted gem held in gold claws on a slender
pearl body. Its exhaust is three thin beams, red, green and violet, that blend
to white where they overlap and leave coloured fringes either side, with
sparks of every colour. Additive shells always mix toward white, so a single
plume cannot show bands like this.

Two rules hold the set together:

- **Silhouette first.** Each ship is a different shape, not a recolour, so
  you should be able to tell them apart as black cutouts.
- **Exhaust colour is the player ID.** The first six are the classic player
  colours (orange, blue, violet, gold, green, crimson) and stay separable at a
  glance in a full lobby of six. The second six fill the gaps (lime, teal,
  indigo, pink) and then step off the colour wheel (white, spectrum). Twelve
  cannot all be far apart: teal/green and indigo/blue are the closest pairs.
  That is why plumes are per-ship rather than a shared effects sheet.

The Marauder's hull is gunmetal rather than true black on purpose: the sky goes
to near-black at the top of the climb, and a genuinely dark ship would lose its
silhouette exactly when the race is being decided.

---

## Anchors — the one thing to know

**Every frame shares the same anchor: the ship's centre.** Frames carry `ax`/`ay`,
and you draw so that point lands where the ship is:

```js
function drawFrame(ctx, ship, name, x, y) {
  const f = ship.atlas.frames[name];
  ctx.drawImage(ship.img, f.x, f.y, f.w, f.h, x - f.ax, y - f.ay, f.w, f.h);
}
```

This holds across rockets too — the anchor is the same in every sheet, so
swapping a player's rocket is a change of which `ship` object you pass, nothing
else.

Because the anchor is shared, the thruster, zap and blastoff frames line up with
the ship frame at the *same* `x, y` — no per-animation offset maths. Draw order
is thruster → ship → zap.

The art is authored in the same units `drawRocket()` already uses in
`prototype.html` (nose at `y = -46`, hull base at `y = 30`, fin tips at
`x = ±34`), so sprites drop in at 1:1 with the existing positioning.

---

## Animations

Identical in every rocket's sheet:

| Name | Frames | fps | Loops | Use |
|---|---|---|---|---|
| `ship` | 1 | — | — | the hull, always drawn |
| `thrust_t0`…`thrust_t4` | 4 each | 24 | yes | speed tiers 0–4 |
| `zap` | 6 | 18 | yes | hull breach / stall overlay |
| `blastoff` | 8 | 7 | **no** | ignition, ~1.1s |

### Thruster tiers

Five tiers, mapped from `speed / maxSpeed`. They ramp on length, width, colour
temperature and detail, so the plume gets visibly meaner as the player types
faster rather than just longer:

| Tier | Length | Reads as |
|---|---|---|
| 0 | 16px | cold sputter, just lit |
| 1 | 30px | steady cone, sparks appear |
| 2 | 46px | mach diamonds appear |
| 3 | 64px | white-hot core, heavy sparks |
| 4 | 82px | full plume, widest halo |

```js
const n = ship.atlas.tiers;
const tier = Math.min(n - 1, Math.floor(speed / cfg.maxSpeed * n));
```

Each tier is 4 frames of flicker at 24fps — enough that the flame never looks
frozen, cheap enough that the whole ramp is 20 frames.

The prototype's flame currently reaches `20 + thrust * 160` ≈ 260px at max. The
tier-4 sprite is 82px, so either scale the plume vertically at draw time or pull
that constant down. Scaling the sprite vertically holds up fine — the plume is
long and soft, so stretching it does not read as distortion.

### Zap (hull breach)

Overlay drawn *on top of* the ship frame while the stall is running. Six frames
at 18fps that strobe hard between bright and near-dark — a steady glow reads as
a shield, a stuttering one reads as shorting out, which is the "paralysed" cue
you wanted.

The body tint is kept deliberately light so the hull colours stay readable
underneath and a player can still tell which rocket is theirs mid-stall.

```js
if (stalled) {
  drawFrame(ctx, ship, frameAt(ship, 'zap', now), x, y);
}
```

Pair it with the existing screen shake and the effect lands.

### Blastoff

Eight frames, **non-looping**, at 7fps ≈ 1.14s — matched to `LAUNCH_DURATION`
(1.1s). Replaces the thruster animation while it plays, then hands over to the
normal speed-driven tier.

Frames are 192×224 rather than 96×176 because the exhaust cloud is much wider
than the ship. The anchor still lands on the ship centre, so nothing changes at
the call site.

Beat sheet: `0` ignition flash → `1–2` peak flare → `3–5` billowing exhaust
cloud → `6–7` settling into the cruise plume.

---

## Tweaking

Everything worth touching is near the top of `gen-rockets.mjs`:

- `SHIPS` / `FLAME`: palettes
- `TIERS`: the speed ramp (length, width, sparks, mach diamonds, halo)
- `shipA` through `shipL`: hull profiles, nozzles, lightning attach points
- `drawShipA` through `drawShipL`: the art, as a back-to-front stack of
  `part()` calls
- `ROSTER`: which rockets get built

Each `part()` gets its own dark keyline, which is what keeps overlapping pieces
(fins behind hull, boosters beside fuselage) from fusing into one pale mass.
If you add a piece, add it as its own `part()`.

`SS` is the supersample factor (3). Everything is drawn at 3× and box-averaged
down, which is where the clean edges come from. Raising it costs render time and
nothing else.
