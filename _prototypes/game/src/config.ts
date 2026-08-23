/**
 * Every number worth arguing about, in one file.
 *
 * The physics block is what the dev panel edits live. Everything below it is
 * staging: where things sit on screen and when they happen along the run.
 */

// ---------------------------------------------------------------------------
// Physics (dev-tunable)
// ---------------------------------------------------------------------------

export interface RaceConfig {
  /** Speed added per correct character. */
  accel: number;
  /** Seconds for speed to halve while you are not typing. */
  halfLife: number;
  /** Hull segments. Hitting zero stalls the ship, it does not destroy it. */
  maxHull: number;
  /**
   * Total speed x time needed to cross the solar system: the one race-length knob.
   *
   * Typing is endless, so there is no paragraph length to calibrate against.
   */
  raceDistance: number;
  maxSpeed: number;
  /**
   * The cruise floor decay never goes below, once the engines are lit.
   *
   * The ship is only ever at a true zero in the two cases where it is meant to be
   * dead in the water: cold on the pad before the first keystroke, and locked out
   * during a hull-breach stall. Everywhere else it keeps ticking forward, so a
   * mistake or a pause reads as losing your hard-won speed rather than as the
   * scene freezing.
   */
  minSpeed: number;
  /**
   * Seconds the ship is locked out after a hull breach.
   *
   * The single biggest lever on how punishing a breach feels, so it belongs on
   * the dev panel next to hull segments rather than buried as a constant: the
   * two are only meaningful when tuned against each other.
   */
  stallDuration: number;
}

export const DEFAULT_CONFIG: Readonly<RaceConfig> = {
  accel: 0.09,
  halfLife: 1.4,
  maxHull: 5,
  raceDistance: 30,
  maxSpeed: 1.2,
  minSpeed: 0.15,
  stallDuration: 5,
};

/** Speed below this is treated as a dead stop, so decay actually reaches zero. */
export const EPS = 0.001;

/** Ignition flare, matched to the blastoff animation (8 frames at 7fps ~ 1.14s). */
export const LAUNCH_DURATION = 1.1;

export const PLAYER_NAME = 'Player1';

// ---------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------

/**
 * The camera never moves. The ship is the only thing that travels: its screen y
 * runs from `ROCKET_START_FRAC` of the viewport up to `FINISH_LINE_Y` as progress
 * goes 0 -> 1, and everything else is either fixed or streams past it.
 *
 * This is the framing the canvas prototype landed on after the most iteration, and
 * protoype.md records why: every version where the finish line animated toward the
 * ship read wrong.
 */
export const ROCKET_START_FRAC = 0.72;

/**
 * World y of the heliopause shock front: the line the ship must reach to win.
 *
 * Low enough that the ship's name tag still clears the stats bar when it arrives,
 * and high enough that a good part of the curtain's rays (which reach 250px above
 * the shock front) are on screen rather than cropped off the top.
 */
export const FINISH_LINE_Y = 150;

/**
 * Progress at which the atmosphere is fully behind you.
 *
 * Sky, ground, clouds and stars are driven by `atmo` (progress renormalised over
 * this window) rather than raw progress, which keeps the canvas prototype's
 * carefully tuned dusk-to-space transition intact now that the race continues for
 * another 90% of its length after Earth is gone.
 */
export const ATMO_END = 0.1;

/** How far the ground falls, in px, across the whole atmosphere window. */
export const GROUND_FALL = 3000;

/** Vertical spread of the cloud band, in px per unit of `atmo`. */
export const CLOUD_SPREAD = 3200;

/** Vertical spread of the planet run, in px per unit of progress. */
export const PLANET_SPREAD = 7200;

/** The heliopause is not there at the start: it fades in for the final stretch. */
export const FINISH_REVEAL_AT = 0.84;

/**
 * Stars are scattered over a band three viewports tall so the drift can wrap them,
 * so only about a third of these are on screen at any moment.
 */
export const STAR_COUNT = 440;
export const CLOUD_COUNT = 22;

/**
 * Cloud idle motion: sideways wind, and the slow churn of the body itself.
 *
 * `CLOUD_WIND` is px/sec of lateral drift before the parallax factor, all in one
 * direction because wind has a direction: clouds crossing each other in opposite
 * directions at the same altitude reads as a screensaver.
 *
 * `CLOUD_BILLOW` stretches x and y on separate cycles rather than scaling
 * uniformly, so the silhouette actually changes shape as it churns instead of
 * pumping in and out like a balloon.
 */
export const CLOUD_WIND = [7, 26] as const;
export const CLOUD_BILLOW = 0.05;
/** Degrees of lazy roll either side of upright. */
export const CLOUD_ROLL = 2.2;

/**
 * Twinkle: how fast a star's brightness cycles, and how far it dips.
 *
 * Every star gets its own rate and depth inside these ranges, so the field never
 * pulses in unison. `TWINKLE_SCALE` is how much of the dip also shows up as size,
 * which is what makes it read as a scintillating point rather than a fading dot.
 */
export const TWINKLE_RATE = [0.5, 2.6] as const;
export const TWINKLE_DEPTH = [0.2, 0.75] as const;
export const TWINKLE_SCALE = 0.3;

/**
 * Plume length in px below the ship's base, per thruster tier.
 *
 * From assets/rockets/README.md. The bars under the ship track this so a lit
 * thruster never covers the readouts.
 */
export const TIER_LEN = [16, 30, 46, 64, 82];

export type PlanetName = 'moon' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

/**
 * The outbound run. `at` is the progress at which the body is level with the ship,
 * so it is above you before that and below you after.
 *
 * Order matches `order` in assets/planets/planets.json. Sizes there are
 * readable-not-physical already; `scale` on top of that is how close you pass.
 */
export interface Leg {
  body: PlanetName;
  /** Progress at which the body passes the ship. */
  at: number;
  /** Horizontal position as a fraction of the viewport width. */
  x: number;
  /** Draw scale: how close this body is passed. */
  scale: number;
  /** Parallax factor. Lower means it drifts by more slowly, so it reads as further away. */
  depth: number;
  /**
   * Axial rotation in degrees per second.
   *
   * Every body is one static sprite, so this is where all of its life comes from.
   * A body is on screen for roughly 7s at a normal pace, which is why these are
   * only a few degrees a second: enough that the surface is visibly turning, not
   * so much that the baked-in sun direction visibly swings round with it.
   */
  spin: number;
  /**
   * Rock through +/- `spin` degrees instead of turning continuously.
   *
   * For the two ringed bodies only. A ring plane rotating all the way round the
   * picture reads as the sprite being spun, not as the planet turning, and Uranus'
   * near-vertical rings are the one detail that makes it readable as Uranus.
   */
  rock?: boolean;
  /** Halo tint, roughly the body's own colour. */
  glow: string;
}

export const RUN: readonly Leg[] = [
  { body: 'moon', at: 0.16, x: 0.31, scale: 0.62, depth: 0.62, spin: 3.5, glow: '#b9c2d6' },
  { body: 'mars', at: 0.3, x: 0.73, scale: 0.52, depth: 0.54, spin: 4, glow: '#e0794a' },
  { body: 'jupiter', at: 0.44, x: 0.26, scale: 0.92, depth: 0.7, spin: 2, glow: '#e8b98a' },
  { body: 'saturn', at: 0.57, x: 0.72, scale: 0.78, depth: 0.64, spin: 2.5, rock: true, glow: '#e6d3a3' },
  { body: 'uranus', at: 0.69, x: 0.3, scale: 0.56, depth: 0.5, spin: 3, rock: true, glow: '#8fe4e8' },
  { body: 'neptune', at: 0.79, x: 0.71, scale: 0.6, depth: 0.52, spin: 3, glow: '#5b7dff' },
  { body: 'pluto', at: 0.88, x: 0.37, scale: 0.42, depth: 0.44, spin: 5, glow: '#cbb59a' },
];

/**
 * Planet idle motion: how far each body breathes in scale, drifts sideways, and
 * how strong its halo sits.
 *
 * All of it is small on purpose. The read is "these are alive and I am moving past
 * them", not "these are wobbling".
 */
export const PLANET_BREATHE = 0.022;
export const PLANET_SWAY = 14;
/** Halo diameter as a multiple of the body's own disc diameter. */
export const PLANET_HALO_SPAN = 2.4;
export const PLANET_HALO_OPACITY = 0.34;

/**
 * Draw order. The camera is locked, so this is the whole depth story.
 */
export const Z = {
  sky: -100,
  stars: -90,
  planets: -80,
  heliopause: -70,
  horizonGlow: -63,
  skyline: -62,
  hillsFar: -61,
  hillsNear: -60,
  pad: -50,
  cloudsBack: -40,
  rocket: 0,
  cloudsFront: 10,
  effects: 20,
} as const;

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

/**
 * ONE gradient whose stop colours lerp between these keys, never two gradients
 * cross-fading over each other. protoype.md records the second approach as a dead
 * end: it reads as a muddy smear.
 *
 * Keyed on `atmo`, not progress.
 */
export const SKY_KEYS: readonly { at: number; top: [number, number, number]; bot: [number, number, number] }[] = [
  { at: 0.0, top: [26, 34, 72], bot: [206, 116, 76] }, // 6pm dusk, warm horizon
  { at: 0.16, top: [21, 28, 64], bot: [104, 80, 120] }, // last light fading
  { at: 0.4, top: [14, 20, 50], bot: [36, 44, 94] }, // upper atmosphere
  { at: 0.7, top: [7, 10, 28], bot: [16, 20, 50] }, // edge of space
  { at: 1.0, top: [3, 4, 10], bot: [10, 13, 28] }, // space
];
