/**
 * In-race tuning. Network and bot behaviour only: the physics all comes from
 * `@heliotyper/engine`, and nothing here is allowed to duplicate it.
 */

/**
 * How often the server broadcasts the pilots it owns, in Hz.
 *
 * The netcode spike landed on 10-20Hz for continuous position on the grounds
 * that interpolation matters far more than raw rate: at 12Hz with interpolation
 * on, remote rockets glide, and 30Hz with it off looks worse.
 */
export const SNAPSHOT_HZ = 12;

/**
 * Simulation tick, well above the broadcast rate.
 *
 * Physics does not need it, since every update takes a measured dt rather than
 * assuming a fixed step. The broadcast is quantised to this tick, so a loop that
 * really lands near the snapshot rate cannot deliver it cleanly.
 */
export const TICK_HZ = 60;

/** Cap the step so a stalled event loop cannot teleport a bot forward. */
export const MAX_DT = 0.05;

/** Bot typing speed range, drawn per bot from the match seed. */
export const BOT_WPM_MIN = 38;
export const BOT_WPM_MAX = 95;

/** Chance per character that a bot fumbles it. */
export const BOT_ERROR_RATE = 0.02;

/** How long the race record and its roster outlive the match, in seconds. */
export const RACE_TTL_S = 3600;

/**
 * How long an ownership claim lasts before it can be taken over.
 *
 * Refreshed on every tick by the instance holding it, so it only lapses if that
 * process actually stopped ticking.
 */
export const OWNER_TTL_MS = 15_000;

/**
 * How long after the last pilot finishes before the room is torn down.
 *
 * Long enough for a straggler's final snapshot to arrive and for results to go
 * out, short enough that a finished race is not held in memory.
 */
export const ROOM_LINGER_MS = 20_000;

/**
 * Give up on a race that will clearly never finish.
 *
 * A pilot who walks away mid-run would otherwise hold the room, and its bots,
 * alive forever.
 */
export const RACE_MAX_MS = 15 * 60_000;
