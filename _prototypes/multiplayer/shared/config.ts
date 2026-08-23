/**
 * Physics config, shared verbatim between server and client.
 *
 * Trimmed down from _prototypes/game/src/config.ts to just
 * the dev-tunable physics block: this playground is about netcode, not staging,
 * so none of the sky/cloud/planet layout constants come along.
 */

export interface RaceConfig {
  /** Speed added per correct character. */
  accel: number;
  /** Seconds for speed to halve while you are not typing. */
  halfLife: number;
  /** Hull segments. Hitting zero stalls the ship, it does not destroy it. */
  maxHull: number;
  /** Total speed x time needed to finish: the one race-length knob. */
  raceDistance: number;
  maxSpeed: number;
  /** The cruise floor decay never goes below, once the engines are lit. */
  minSpeed: number;
  /** Seconds the ship is locked out after a hull breach. */
  stallDuration: number;
}

export const DEFAULT_CONFIG: Readonly<RaceConfig> = {
  accel: 0.09,
  halfLife: 1.4,
  maxHull: 5,
  // Shorter than the real game's 30. A netcode prototype you have to type for
  // three minutes to observe is a netcode prototype nobody runs twice.
  raceDistance: 12,
  maxSpeed: 1.2,
  minSpeed: 0.15,
  stallDuration: 5,
};

/** Speed below this is treated as a dead stop, so decay actually reaches zero. */
export const EPS = 0.001;

/** Ignition flare duration in seconds. */
export const LAUNCH_DURATION = 1.1;

/** Max pilots in one race, per the rating doc's settled lobby size. */
export const MAX_PLAYERS = 6;

// ---------------------------------------------------------------------------
// Netcode defaults (all dev-tunable at runtime)
// ---------------------------------------------------------------------------

export interface NetConfig {
  /**
   * How often the server broadcasts the aggregated snapshot of every pilot, in Hz.
   *
   * The doc's 4.9 lands on 10-20Hz for continuous position/speed on the grounds
   * that interpolation matters far more than raw rate. This panel is where you
   * check that claim rather than take it on faith.
   */
  snapshotHz: number;
  /**
   * How often the client flushes its own state up to the server, in Hz.
   * Independent of the broadcast rate: uplink and downlink do not have to match.
   */
  clientSendHz: number;
  /** Simulated one-way network delay in ms, applied to both directions. */
  latencyMs: number;
  /** Random +/- variation added to latency, in ms. */
  jitterMs: number;
  /** Fraction of packets to drop outright, 0..1. */
  packetLoss: number;
  /**
   * Render remote pilots this far in the past, in ms.
   *
   * Interpolation needs two snapshots to sit between, so it has to render behind
   * the newest one it holds. Roughly 1.5 snapshot intervals is the usual starting
   * point: too low and it runs out of buffer and stutters, too high and remote
   * ships visibly lag their true position.
   */
  interpDelayMs: number;
  /**
   * Turn interpolation off to see the raw snapshot stream.
   *
   * This is the single most instructive toggle in the panel. At 10Hz with
   * interpolation on, remote rockets glide. Off, they teleport 10 times a second,
   * which is exactly what the doc claims and exactly what nobody believes until
   * they watch it happen.
   */
  interpolate: boolean;
}

export const DEFAULT_NET: Readonly<NetConfig> = {
  snapshotHz: 12,
  clientSendHz: 12,
  latencyMs: 60,
  jitterMs: 20,
  packetLoss: 0,
  interpDelayMs: 125,
  interpolate: true,
};

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

export interface BotConfig {
  /** How many bot pilots to fill the lobby with. */
  count: number;
  /** Bot typing speed range in WPM, drawn per bot. */
  wpmMin: number;
  wpmMax: number;
  /** Chance per character that a bot fumbles it, 0..1. */
  errorRate: number;
}

export const DEFAULT_BOTS: Readonly<BotConfig> = {
  count: 4,
  wpmMin: 35,
  wpmMax: 95,
  errorRate: 0.02,
};
