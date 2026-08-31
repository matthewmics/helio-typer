/**
 * Matchmaking tuning. Every value here is a policy decision, not a physics one,
 * so none of it belongs in the shared race config.
 */

/** Pilots in a race. Settled at 6 in the rating doc, same as the prototype. */
export const LOBBY_SIZE = 6;

/**
 * How long a guest waits for real opponents before bots fill the lobby.
 *
 * The queue is empty most of the time in a game with no players yet, and a queue
 * that never resolves is indistinguishable from a broken one. Ten seconds is long
 * enough that two guests arriving together still meet each other, and short enough
 * that a lone guest is racing before they give up.
 */
export const BOT_FILL_AFTER_MS = 10_000;

/** Seconds a pilot has to accept a found match before it is abandoned. */
export const READY_CHECK_MS = 15_000;

/** How often each instance asks Redis to try to form a match. */
export const QUEUE_TICK_MS = 1_000;

/** How often each instance sweeps for ready checks that ran out of time. */
export const SWEEP_TICK_MS = 1_000;

/** Ready checks reaped per sweep, so one instance cannot stall on a huge batch. */
export const SWEEP_BATCH = 20;

/**
 * How long a guest identity outlives its socket.
 *
 * Long enough that a page refresh keeps the same callsign, short enough that
 * abandoned guests do not accumulate. Guests are not accounts and are never
 * meant to be durable.
 */
export const GUEST_TTL_S = 3600;
