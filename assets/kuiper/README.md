# Kuiper belt

The field of icy bodies past Neptune, with Pluto inside it. One sheet,
`kuiper.png`, 512×296, 14 frames, ~67KB.

```
node assets/kuiper/gen-kuiper.mjs
```

Open `preview.html` directly in a browser to see every frame turning and a
field of them streaming past. No server needed.

| File | What it is |
|---|---|
| `kuiper.png` / `.json` | the sheet + frame rects |
| `atlas.js` | the atlas as `window.KUIPER_ATLAS`, for `file://` loading |
| `gen-kuiper.mjs` | the generator, source of truth for the art |
| `preview.html` | animated viewer |

Every frame is anchored at its **centre**. Draw at `(x - ax, y - ay)`.

---

## A kit, not a sequence

Every planet is one body the run passes once. The belt is a field: the game
scatters dozens of copies of these through the stretch past Neptune, each
turned, sized and placed at a depth of its own, so a handful of sprites reads as
hundreds of bodies.

| Frames | What they are |
|---|---|
| `kbo_0` … `kbo_5` | the rocks, listed under `bodies`: red, grey, rust and ice, in 128px cells |
| `pebble_0` … `pebble_5` | the small fry, listed under `pebbles`, in 40px cells |
| `arrokoth` | the red two-lobed contact binary New Horizons flew past in 2019 |
| `haumea` | the icy egg, stretched by one of the fastest spins in the solar system, with its dark red spot |

`arrokoth` and `haumea` are left out of `bodies` on purpose. Each is one real
object, so the game places it once instead of scattering copies.

**The colours follow the real belt.** Most of it is red, from tholins: organics
cooked out of surface ice by billions of years of faint sunlight and cosmic
rays. Some of it is neutral grey, and a few bodies are fresh, bright ice.

---

## Why a field, and why it stops short

The finish only lands if it is a different kind of object from everything
passed on the way (see [`finish/README.md`](../finish/README.md)). The belt
keeps that intact: it is still bodies you pass, streaming by like the planets,
just many small ones instead of one big one. It never forms a line across the
screen.

It also ends before the heliopause, so the last stretch of the race is open
space, with the curtain ahead and the belt behind you.

---

## Tweaking

Near the top of `gen-kuiper.mjs`:

- `ROCK` / `PEBBLE`: cell sizes and anchors
- `PAL`: the four palettes
- `ROCKS` / `PEBBLES`: size, lumpiness and squash per frame, and how much
  surface detail each one gets
- `lumpy`: the outline, a circle whose radius wanders with a few harmonics
- `shadeRock`: limb darkening plus light from the upper left

Two things worth not re-breaking:

- **Shading measures against the rock's own outline.** Dividing by a single
  radius, as the planets do, shades a lumpy rock as if it were the round body
  inside it, and every lump outside that circle goes flat.
- **Small outlines need gentle lumps.** A few pixels across, one deep notch is
  all an outline has left, and it reads as a little heart. The pebbles and
  `kbo_5` are kept gentle for that reason.
