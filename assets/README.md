# Assets

Grouped by subject, one folder each. A group owns its art, its atlas, its
generator and its preview, so nothing outside the folder changes when you add
to it.

| Group | What's in it |
|---|---|
| [`rockets/`](rockets/) | the playable rockets — one spritesheet per rocket, plus the roster index |
| [`planets/`](planets/) | the outbound run: moon, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto |
| [`kuiper/`](kuiper/) | the Kuiper belt: a kit of icy rocks the game scatters past Neptune, plus Arrokoth and Haumea |
| [`finish/`](finish/) | the finish line — the heliopause, at the edge of the solar system |
| [`effects/`](effects/) | particle textures (smoke, spark, ember, star) and the hull-breach burst |
| [`environment/`](environment/) | clouds, ground parallax strips, the launch pad |
| [`lib/`](lib/) | the shared software rasteriser the generators are built on |

Each group has its own README with frame lists, anchors and usage.

## How this works

Art here is **generated, not hand-drawn**. Every group ships a `gen-*.mjs` that
writes its own output alongside itself:

```
node assets/rockets/gen-rockets.mjs
node assets/planets/gen-planets.mjs
node assets/kuiper/gen-kuiper.mjs
node assets/finish/gen-finish.mjs
node assets/effects/gen-effects.mjs
node assets/environment/gen-environment.mjs
```

No dependencies and no build step — plain `node`, matching the prototype's
no-install ethos. `lib/raster.mjs` is a software rasteriser (premultiplied float
layers, 3× supersampling, box blur, scanline polygon fill) plus a hand-rolled
PNG encoder over `node:zlib`. The generators only supply the art.

**The generator is the source of truth.** Edit it and rerun; don't touch the
PNGs. Output is deterministic, so rerunning produces byte-identical files and
only real changes show up in a diff.

## Conventions

- **Every frame carries an anchor** (`ax`, `ay`). Draw at `(x - ax, y - ay)` and
  it lands correctly — no per-frame offset maths. Anchors are usually the
  centre; the exceptions are documented per group.
- **Overlays share their base frame's cell**, so they line up when drawn at the
  same position: the rockets' `zap` over `ship`, the clouds' `_rim` over
  `cloud_*`, the moon's `beacon_*` over `moon`.
- **Some frames are white and meant to be tinted at runtime** — smoke, sparks
  and clouds. Each atlas lists them under `tintable`. Tint rather than asking
  for a recoloured copy.
- **Atlases ship twice**: as `.json` for the game, and mirrored into `atlas.js`
  as a `window.*` global so the previews run from `file://` without a server.
- **Strips that tile horizontally** are listed under `tileableX` — the ground
  layers and the heliopause. Their patterns are sums of sines at *integer*
  frequencies over the cell width, so the seam is invisible at any viewport
  size. Keep those frequencies integer if you edit them.

## The race, end to end

```
launch pad → clouds → moon → mars → jupiter → saturn
           → uranus → neptune → the Kuiper belt, with pluto in it
           → THE HELIOPAUSE
```

Everything you pass is a body: the planets one at a time, the Kuiper belt a
whole field of small ones. The finish line is a wall you cross. That contrast is
deliberate, see [`finish/README.md`](finish/README.md).

## Not generated, on purpose

The sky gradient and the starfield stay as code in the game. `protoype.md`
records that stacked gradient art reads as a muddy smear and that the single
lerped gradient is what works — baking sky into sprites would be a regression.
