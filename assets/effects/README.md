# Effects

Particle textures and the hull-breach burst. One sheet, `effects.png`,
768×512, 15 frames, ~190KB.

```
node assets/effects/gen-effects.mjs
```

Open `preview.html` directly in a browser — it fires a real particle burst and
the breach animation, no server needed.

| File | What it is |
|---|---|
| `effects.png` / `.json` | the sheet + frame rects |
| `atlas.js` | the atlas as `window.FX_ATLAS`, for `file://` loading |
| `gen-effects.mjs` | the generator — source of truth for the art |
| `preview.html` | animated viewer |

Every frame is anchored at its **centre**, so you draw at
`(x - ax, y - ay)` and the sprite lands on the particle position.

---

## Tint these, don't recolour them

`smoke_0..3`, `spark`, `ember` and `star` are **white**, with only form shading
baked in. They are meant to be multiplied by a tint at runtime — the atlas lists
them under `tintable`.

That's deliberate. The prototype already needs smoke in three different moods
([prototype.html:254](../../prototype.html#L254) launch smoke is warm grey,
[prototype.html:597](../../prototype.html#L597) damage smoke is dark grey, and
high-altitude exhaust wants to be cold). Baking colour in would mean one sheet
per mood; one white texture covers all of them.

The game multiplies each tinted frame once, per pixel, onto a small canvas of its
own and caches it (`Atlas.tinted` in [web/game/atlas.ts](../../web/game/atlas.ts)).
`preview.html` has a shorter `tinted()` helper built on composite operations,
which is fine for a preview but slightly lightens soft edges.

| Frame | Size | Use |
|---|---|---|
| `smoke_0` … `smoke_3` | 96×96 | exhaust, launch cloud, damage smoke. Pick one at random per particle so a burst doesn't visibly repeat |
| `spark` | 32×32 | ignition sparks, mistake sparks — has cross flares |
| `ember` | 32×32 | soft round glow, for slower drifting embers |
| `star` | 32×32 | starfield dot, if you want softer stars than `arc()` gives |

Smoke is lit from above (the underside is ~50% darker), so it still has form
once tinted flat.

---

## Hull-breach burst

`breach_0..7`, 192×192, **non-looping** at 16fps ≈ 0.5s.

This is the one-shot moment hull hits zero — the rockets' `zap` animation covers
the *sustained* stall that follows, so the two are meant to play in sequence:
breach fires once, then zap loops for the rest of `STALL_DURATION`.

It carries its own electric palette rather than being tintable, because it's a
complete effect rather than a particle — and it's the same cyan the rockets' zap
overlay uses, so the two read as one phenomenon.

Beat sheet: `0` white-out flash → `1–2` shock ring punches out with radial bolts
→ `3–5` ring expands and crackles, debris sparks → `6–7` fading ring.

```js
// at the moment hull hits zero
playOnce('breach', shipX, shipY);   // effects sheet
startLoop('zap', shipX, shipY);     // rocket sheet, for the stall
```

Drop it in at the ship's centre. It replaces the `spawnSparks()` call in
[prototype.html:283](../../prototype.html#L283).

---

## Tweaking

Everything is near the top of `gen-effects.mjs`:

- `ARC` — the breach palette
- `PUFF` / `DOT` / `BURST` — cell sizes and anchors
- `renderSmoke` — lobe count and arrangement
- `renderBreach` — the `flash` / `ringA` / `R` / `thick` curves, one entry per frame

Two things that were wrong on the first pass and are worth not re-breaking:

- The shock ring's blob count **scales with circumference**. A fixed count
  leaves visible gaps once the ring is large, and the ring reads as a dotted
  circle instead of a shockwave.
- Smoke uses near-solid discs with a tight falloff. A soft falloff plus blur
  averages the whole puff into fog and loses the cauliflower edge.
