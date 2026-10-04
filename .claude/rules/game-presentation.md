# Game presentation

How the run is staged and drawn. Art lives in [assets/](../../assets), generated
rather than hand-drawn, one folder per subject with its own README.

## Rendering

Plain Canvas 2D, no game engine. [web/game/stage.ts](../../web/game/stage.ts)
owns the canvas, the fit-to-window scaling, the frame loop and screen shake, and
[RaceScene](../../web/game/scenes/RaceScene.ts) draws every layer back to front.

ExcaliburJS was removed on 2026-10-03. Its loader painted an engine logo and a
progress bar over the canvas before every race, and the game used little of the
engine beyond sprites and one particle emitter.

- **No splash or loading screen.** The first frame drawn is the launch pad. A
  loading line exists, but only fades in if fetching the art takes longer than
  about half a second.
- **Do not bring a game engine back** without asking first.

## The outbound run

```
launch pad -> clouds -> moon -> mars -> jupiter -> saturn
           -> uranus -> neptune -> pluto -> THE HELIOPAUSE
```

- Every intermediate body (moon, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto)
  is a disc landmark the ship passes, sized for readability rather than
  real-world scale. See [assets/planets/README.md](../../assets/planets/README.md).
- The moon is the first thing you pass, not the finish.
- The finish is deliberately not a disc. The heliopause is a full-width
  shimmering aurora curtain spanning the screen, so reaching it reads as
  crossing an edge rather than passing one more planet. See
  [assets/finish/README.md](../../assets/finish/README.md).

## Camera and framing

- The camera is locked for the entire race, so world space is screen space. It
  never pans, never zooms. Screen shake (`Stage.shake`) is the only thing that
  touches it.
- The ship's screen position rises with `progress`, from `ROCKET_START_FRAC` of
  the viewport up to `FINISH_LINE_Y`.
- The heliopause does not move. It is the edge you arrive at, so it holds
  position while everything else streams by.
- Intermediate bodies each sit at a fixed point along the run and stream past
  with their own parallax factor, so they read as bodies at different distances
  rather than a row of stickers at the same depth. Each body also has its own
  breathe and sway phase so no two move in step.
- Starfield drift is cosmetic only, decoupled from actual position.
- **Other pilots are placed relative to your ship, on the scenery's scale**
  (`fieldY` in [view.ts](../../web/game/view.ts)): the ground's fall through the
  atmosphere, the planets' spread in space. A pilot more than a few percent
  ahead or behind is off screen and shows only on the rail. Do not map each
  pilot's own progress onto the ship's climb instead: that squeezes the whole
  race into one screen height, and a pilot a quarter of the race ahead draws
  right beside you, in front of scenery they passed long ago.

> **Unresolved.** The original locked lesson was "a fixed landmark must never
> move toward the ship; only the ship moves." The current port satisfies that for
> the finish but not for the intermediate bodies, which stream past with
> parallax. Both readings are defensible and the code currently does the second.
> Flagged rather than silently resolved.

## Two clocks, not one

- Sky, ground, clouds and stars run on `atmo`, which is `progress / ATMO_END`
  clamped to 1, with `ATMO_END = 0.10`.
- So the entire dusk-to-space climb happens in the first 10% of the run and the
  remaining 90% is space. This preserves the carefully tuned atmosphere sequence
  without re-tuning it against the much longer race, and it puts Earth behind you
  before the moon shows up.

## Atmosphere

- **Ground**: dusk scene with hill silhouette, backlit skyline, launch pad and
  gantry, falling away in the first few percent of the climb.
- **Clouds**: real cloud objects at fixed altitudes with parallax depth stream
  past the ship. A portion draw in front of the rocket for depth.
- **Sky**: one gradient whose stop colors lerp through keyframes from dusk to
  black space. Two cross-fading gradients were tried and rejected, they read as a
  muddy smear. Do not reintroduce that approach.
- **Stars**: invisible at ground level, fade in as altitude increases.

## HUD

- Player name pill above the ship's nose.
- Hull segments and a speed bar below the fins, both easing downward to stay
  clear of the growing exhaust plume.
- The progress rail carries a dot for every other pilot, smaller and paler than
  yours. It is the only place a pilot who is off screen still shows.
