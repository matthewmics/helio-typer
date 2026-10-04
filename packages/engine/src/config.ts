/**
 * Physics, and only physics.
 *
 * The staging constants (sky keyframes, planet layout, parallax spreads, HUD
 * offsets) deliberately stay in `web/game/config.ts`. The server has to run this
 * simulation and has no screen to place anything on, so anything it cannot use
 * does not belong in a package it imports.
 */

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
   * The ship is only ever at a true zero in the three cases where it is meant to
   * be dead in the water: cold on the pad before the first keystroke, locked out
   * during a hull-breach stall, and after the finish. Everywhere else it keeps
   * ticking forward, so a mistake or a pause reads as losing your hard-won speed
   * rather than as the scene freezing.
   */
  minSpeed: number;
  /**
   * Seconds the ship is locked out after a hull breach.
   *
   * The single biggest lever on how punishing a breach feels, so it is tuned
   * against hull segments rather than buried as a constant.
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
  stallDuration: 1,
};

/** Speed below this is treated as a dead stop, so decay actually reaches zero. */
export const EPS = 0.001;

/** Ignition flare, matched to the blastoff animation (8 frames at 7fps ~ 1.14s). */
export const LAUNCH_DURATION = 1.1;

/**
 * Progress at which the atmosphere sequence completes.
 *
 * Physics rather than staging, because `Race.atmo` is derived from it, but the
 * reason for the value is presentational: the whole dusk-to-space climb happens
 * in the first 10% of the run so the tuned atmosphere sequence did not have to be
 * redone against a much longer race.
 */
export const ATMO_END = 0.1;

/**
 * Plume length in px below the ship's base, per thruster tier.
 *
 * Staging in origin, but `Race.tier` buckets speed against its length, so the
 * server needs it to report the same tier the client would draw.
 */
export const TIER_LEN = [16, 30, 46, 64, 82];
