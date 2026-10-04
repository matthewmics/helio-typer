# Finish line — the heliopause

The edge of the solar system: where the solar wind stalls against interstellar
space. Drawn as a shimmering aurora curtain standing across the whole screen.

One sheet, `finish.png`, 1024×1920, 6 frames, ~1.5MB.

```
node assets/finish/gen-finish.mjs
```

Open `preview.html` directly in a browser — it flies the ship up to the boundary
so you can see it tiled, animated and crossed. No server needed.

| File | What it is |
|---|---|
| `finish.png` / `.json` | the sheet + frame rects |
| `atlas.js` | the atlas as `window.FINISH_ATLAS`, for `file://` loading |
| `gen-finish.mjs` | the generator — source of truth for the art |
| `preview.html` | animated viewer |

---

## Why a wall and not another planet

Every landmark on the run — moon, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto
— is a **disc**. If the finish line is also a disc it reads as "one more
planet," and the moment you've been climbing toward for the whole race lands
flat.

A full-width boundary is a different *kind* of object. Arriving at it reads as
arriving at an edge, not passing another rock. It's also the literal, real
answer to "what's past Neptune" — the heliopause is where the sun's influence
actually ends, and it's the thing Voyager 1 crossed in 2012.

It suits the locked camera too. The moon was already a fixed landmark that never
moves; a horizontal curtain pinned near the top of the screen is the same idea,
but it spans the full width, so there is no way to read it as "off to one side."

---

## Using it

Anchored at the **left edge, on the shock front** — the same convention as the
ground strips. Draw at `(tileX, finishLineY)` and repeat horizontally:

```js
const f = atlas.frames[frameName];
for (let x = 0; x < viewportWidth; x += f.w) {
  ctx.drawImage(img, f.x, f.y, f.w, f.h, x, finishLineY - f.ay, f.w, f.h);
}
```

**Tileable horizontally.** The curtain fields are sums of sines at *integer*
frequencies over the 1024px cell, so `x=0` and `x=1024` evaluate identically and
the seam is invisible at any viewport width. Animating the phase shifts the
pattern without breaking that — so if you edit `field()` frequency lists, keep
them integers.

`heliopause_0..5`, 6fps, **loops**. Slow shimmer, ~1s cycle.

**Composite it additively** (`globalCompositeOperation = 'lighter'`). It's a
glow sheet: every pixel is either transparent or brighter than the sky, so
additive is both correct and stops the starfield behind it from being dimmed.

### Layout

The anchor sits on the shock front, with the curtain rising **above** it and a
soft underglow **below**, on the approach side:

```
        ░▒▓ rays fade out ▓▒░          <- 250px above the anchor
     ▓█▓ ░▒▓█▓▒░ ▓█▓░ ▒▓█▓▒
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        <- anchor: the shock front
        soft underglow                 <-  70px below
              ▲
             ███                       <- ship approaches from here
```

So `finishLineY` is the y the ship must reach to win — the bright line itself,
not the top of the art.

---

## Tweaking

Near the top of `gen-finish.mjs`:

- `FIN` — cell size and anchor
- `FRAMES` — how many shimmer frames (drop to 4 if 1.5MB is too heavy)
- `COL` — the palette
- `field(seed, freqs)` — **frequencies must be integers** or tiling breaks
- `drawCurtain` — the three depth layers' heights, brightness and falloff

Three things that were wrong on the first pass:

- **Low frequencies alone make a smooth sheet, not aurora.** The curtain needs
  a second high-frequency field (`raysBack/Mid/Front`, f=23…127) sharpened with
  a power curve, so bright rays sit in darker gaps. Without it you get a flat
  glow *and* visible 8-bit banding contours across it.
- **The back layer has to stay dim with a soft falloff.** Give it a bright,
  sharply-topped envelope and its tip edge reads as a hard contour line.
- **Per-pixel dither across large translucent areas wrecks PNG size** — it cost
  ~1MB before it was pulled back to just the flat underglow gradient.
