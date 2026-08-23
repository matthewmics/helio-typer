import type { Engine } from 'excalibur';
import { ATMO_END, FINISH_LINE_Y, GROUND_FALL, ROCKET_START_FRAC } from './config';
import { clamp, lerp } from './util';
import type { Race } from './race';

/**
 * Everything the layers need to place themselves this frame.
 *
 * Recomputed once per tick and handed to each layer's `sync`, so no layer has to
 * know about the engine, the screen, or the race object.
 */
export interface View {
  /** Drawable width in world units. The camera is locked, so world == screen. */
  w: number;
  h: number;
  /** Horizontal centre: the ship never leaves it. */
  cx: number;
  /** The ship's screen y. The only thing in the scene that travels. */
  shipY: number;
  /** Screen y of the pad deck, which is also the horizon line. */
  groundY: number;
  /** How far the ground has already fallen. Layers scale this for vertical parallax. */
  groundFall: number;
  progress: number;
  /** Progress renormalised over the atmosphere window. */
  atmo: number;
  /** Cosmetic starfield drift. Decoupled from position: this is feel, not distance. */
  worldScroll: number;
  /** Seconds since the scene started, for animations that just need a clock. */
  time: number;
}

export function makeView(engine: Engine, race: Race, worldScroll: number, time: number): View {
  const w = engine.screen.drawWidth;
  const h = engine.screen.drawHeight;
  const startY = h * ROCKET_START_FRAC;
  const groundFall = race.atmo * GROUND_FALL;

  return {
    w,
    h,
    cx: w / 2,
    // The ship climbs from near the bottom to the shock front across the whole
    // run. Nothing else moves toward it: the heliopause is pinned and the planets
    // stream past.
    shipY: lerp(startY, FINISH_LINE_Y, race.progress),
    // The pad deck starts under the ship's base and falls away with altitude.
    groundY: startY + SHIP_BASE_OFFSET + groundFall,
    groundFall,
    progress: race.progress,
    atmo: race.atmo,
    worldScroll,
    time,
  };
}

/**
 * Distance from the ship's anchor down to its hull base, in art units.
 *
 * assets/rockets/README.md: the sprites are authored in the same units the canvas
 * prototype used, with the nose at y = -46 and the hull base at y = 30.
 */
export const SHIP_BASE_OFFSET = 30;

/** Progress at which the ground has fallen far enough to stop drawing it. */
export const groundVisible = (view: View): boolean => view.groundY < view.h + 260;

/** Convenience for layers that fade with altitude. */
export const atmoOf = (progress: number): number => clamp(progress / ATMO_END, 0, 1);
