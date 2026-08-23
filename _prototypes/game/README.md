# HelioTyper on ExcaliburJS

The original single-file canvas prototype (since deleted), ported to ExcaliburJS
and running on the generated art in [`assets/`](../../assets).

```
npm install
npm run dev      # http://localhost:5173
```

`npm run build` typechecks and bundles to `dist/`. `npm run typecheck` on its own.

This is step 2 of the roadmap in [`CLAUDE.md`](../../CLAUDE.md): real sprite art,
and the port onto a real engine. What changed is the art, the stack, the length of the race, and one
deliberate physics change: speed now decays to a **cruise floor** rather than to
zero (see below).

---

## The race is now the whole solar system

The canvas prototype raced to the moon. `assets/README.md` documents the run as
going all the way out, so that is what this builds:

```
launch pad → clouds → moon → mars → jupiter → saturn
           → uranus → neptune → pluto → THE HELIOPAUSE
```

The moon is no longer the finish line, it is the first thing you pass. The
finish is the heliopause, which is a **wall**, not another disc. Everything you
pass is a body; the thing you arrive at is an edge. That contrast is the whole
reason the finish art is a full-width curtain.

`progress` is still 0..1 over the whole run and still purely the integral of
speed over time. `raceDistance` (default 30) is the single race-length knob.

### Two clocks, not one

The atmosphere sequence was tuned carefully in the canvas version over
`progress` 0..1. That tuning is preserved by renormalising: sky, ground, clouds
and stars run on **`atmo`**, which is `progress / ATMO_END` clamped to 1, with
`ATMO_END = 0.10`.

So the canvas prototype's whole 0..1 climb now happens in the first 10% of the
run, and the remaining 90% is space. Nothing about the dusk-to-space transition
had to be re-tuned, and Earth is behind you before the moon shows up.

### The ship is only ever stopped when it is supposed to be

The canvas version decayed speed to a dead zero, so a pause or a mistake could
leave the whole scene motionless. Over a race this long that reads as the game
having frozen rather than as you having lost your speed.

So decay now bottoms out at `minSpeed` (`speedFloor` in `race.ts`), and a true
zero is reserved for the three states that mean it:

| State | Speed |
|---|---|
| Cold on the pad, before the first correct keystroke | 0 |
| Locked out by a hull-breach stall | 0 |
| After the finish | 0 |
| Anything else, including a mistake or a long pause | `minSpeed` |

A mistake therefore still costs you every bit of built-up speed, which was always
the point of it, but the ship keeps ghosting forward at the floor. Set the dev
panel's min speed to 0 to get the old dead-stop model back exactly.

---

## Layout of the code

```
src/
  main.ts             engine boot, resolution, display mode
  config.ts           every tunable number, the run table, the z order, the sky keys
  race.ts             the simulation, with no rendering and no DOM in it
  text.ts             the sentence pool
  view.ts             per-frame layout handed to every layer
  atlas.ts            assets/ atlas JSON -> Excalibur sprites and animations
  resources.ts        the only file that reaches outside the prototype
  util.ts             clamp/lerp/smoothstep/sky lerp
  scenes/RaceScene.ts wires the simulation to the layers
  actors/             Sky, Starfield, Ground, CloudLayer, PlanetRun,
                      Heliopause, Rocket, Effects, TiledStrip
  ui/hud.ts           the DOM half: prompt, stats, run rail, dev panel, end screen
```

### `race.ts` has no engine in it, on purpose

Step 3 on the list is a NestJS gateway and a server-authoritative loop. That
only works if the simulation runs without a browser, so `Race` is a plain class
with `update(dt)` and `typeKey(key)` and a set of hooks for anything that
*reacts* rather than reads. Nothing in it imports Excalibur.

The one rule that falls out of that: **hooks never fire during construction**,
because whatever handles them is generally built from the `Race` that is still
being constructed. `reset()` fires them, the constructor does not.

### Art is read from `assets/`, never copied

`resources.ts` imports the PNGs and atlas JSON straight out of `../../../assets`.
`assets/README.md` is explicit that the `gen-*.mjs` generators are the source of
truth and the PNGs should not be hand-edited, so a second copy in here would
silently go stale the next time one is rerun. `vite.config.ts` widens
`server.fs.allow` to the repo root for exactly this reason, and that is the only
thing it exists for.

Rerun a generator and this picks up the new art with no step in between.

### Anchors

Every atlas frame carries an `ax`/`ay` anchor. Excalibur offsets a graphic by
`-width * anchor.x`, so `Atlas.anchorOf()` returns `(ax/w, ay/h)` and the anchor
point lands exactly on the actor. That is the whole adaptation; no per-frame
offset maths anywhere.

The rocket needs two anchors rather than one, since `blastoff` uses a wider cell
(192x224) than `ship`/`thrust`/`zap` (96x176). Hence the child actors in
`Rocket.ts`: they also give the required thruster → ship → zap draw order.

---

## Things worth knowing before changing something

**The camera never moves.** It is pinned to the centre of the drawable area, so
world space is screen space. The ship is the only thing that travels, climbing
from `ROCKET_START_FRAC` to `FINISH_LINE_Y` as progress goes 0..1. Planets stream
past it; the heliopause is pinned and only fades in. The prototype log recorded that
every version where the finish line moved toward the ship read wrong.

**The sky stays as code.** One gradient, two stop colours lerped through five
keyframes. It is rasterised into an 8x128 canvas and stretched, so the per-frame
re-raster costs a thousand pixels rather than two million. Do not replace it with
stacked or cross-faded gradients, and do not bake it into sprites: both were
tried and both read as a muddy smear.

**Nothing in space is a still image.** The planets are single static sprites, so
`PlanetRun` gives each one a slow axial turn, a breathing scale, a sideways drift
and a pulsing tinted halo, all on per-body rates that never line up. Two rules
behind the numbers in `RUN`: spin stays at a few degrees a second, because the
sun direction is baked into each sprite and a fast turn swings it visibly; and
the two ringed bodies `rock` through a small angle instead of turning, because a
ring plane rotating all the way round reads as a spun sticker and Uranus'
near-vertical rings are the one thing that makes it readable as Uranus.

Stars twinkle on their own rate, phase and depth, dipping in size as well as
brightness. Size is what sells it: a point that only fades reads as a dimmer
switch, one that fades and tightens reads as scintillation.

Clouds get the same treatment in `CloudLayer`: a lateral wind that wraps around
the screen edges, an x/y billow on separate cycles, and a lazy roll, all scaled
by parallax depth so a near cloud visibly races a far one. Two things to keep:
the wind runs one direction for every cloud, because clouds crossing each other
at the same altitude reads as a screensaver rather than as weather; and the rim
overlay must take the body's exact transform, since it is the same cell and any
divergence slides the sunset edge off the shape it belongs to.

### The hull breach does not take the prompt away

It used to replace the prompt with a "HULL BREACH: REBOOTING" panel. That hides
the one thing you are looking at, right when you most want to see where you will
resume.

So the sentence now stays exactly where it is and the panel goes dead around it:
greyed out (`grayscale` drains the amber cursor and the blue typed text to the
same dead grey, so nothing looks like it is still taking input), shaking, with
arcs flickering around its border and the countdown on a chip straddling the top
edge. Nothing covers a word.

Two constraints worth not re-breaking. The arcs hug the border rather than
crossing the panel, because bolts drawn through the middle read as a lattice over
the text. And `renderPrompt` does not rebuild the spans while stalled: the stall
calls it every frame to tick the countdown, and rebuilding would restart every
arc animation mid-flicker.

**Tiled strips must sit at exact multiples of the cell width.** The ground layers
and the heliopause tile seamlessly only because their patterns are sums of sines
at integer frequencies over the cell. `TiledStrip` exists to guarantee that
placement and to grow the tile list when the window widens.

**The heliopause tiles all show one frame, driven off the clock.** Two tiles a
frame apart would tear the seam open, which is why it does not use a shared
`Animation` instance.

---

## Two deliberate deviations from the asset READMEs

**No additive blending on the heliopause.** `assets/finish/README.md` asks for
`globalCompositeOperation = 'lighter'`. Excalibur 0.32 has no blend-mode API on
its graphics context, so it draws with normal alpha. Over the near-black sky of
the outer system the two are nearly identical; the only visible difference is
that stars behind the curtain are dimmed rather than shining through. If a later
Excalibur adds blend modes, this is a one-line change in `Heliopause.ts`.

**Launch smoke does not use `ParticleEmitter`.** In Excalibur 0.32 a particle
with a `graphic` renders that graphic at its natural size and ignores the
per-particle `size`, `startSize`/`endSize` and colour fields (only `opacity` is
animated). The launch cloud needs to billow outward as it dissipates, so it runs
on a small pooled sprite system in `Effects.ts` instead. The sparks, which are
uniform, do use `ParticleEmitter`.

---

## Dev panel

Top left, and it edits the live config: accel, decay half-life, hull segments,
hull breach stall, race distance, max speed, min (cruise) speed, plus a rocket
picker. The picker is there to keep the
claim in `assets/rockets/README.md` honest: swapping ships is one call to
`Rocket.useRocket()` and nothing else, because every sheet exposes the same
animation names at the same anchor.

The run rail on the right has one tick per body, so you can see which leg you are
on and what is next.

---

## Still open

Tracked in .claude/notes/ideas.md, none of these are decided here:

- Backspace behaviour
- Whether difficulty tiers change decay rate, hull, or race distance
- Matchmaking model: room codes only, or public quick-match
- Whether hull regenerates outside of stall recovery

New, from making the race long:

- **The coast is long.** At default settings, stopping dead at max speed still
  carries you roughly 30% of the race while speed decays. That may be too
  forgiving over a run this length, and is the first thing to tune.
- **The cruise floor finishes the race for you.** At `minSpeed` 0.15 and
  `raceDistance` 30, a player who launches and then never types again still
  arrives in about three and a half minutes. Fine for a prototype, and it is the
  reason the value is on a dev slider, but a real run probably wants the floor
  scaled to how far out you are, or a time limit, or both.
- Leg pacing in `RUN` is spaced by feel, not by anything principled.
- There is no rocket-destroyed end state. The only way a run ends is arriving.
