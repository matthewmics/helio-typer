import { HASH_TAG } from '../redis/redis.constants';

/**
 * Every Redis key matchmaking owns.
 *
 * All of them carry the `{mm}` hash tag so they share a slot, see
 * `redis.constants.ts` for why. `PREFIX` is passed into the Lua scripts, which
 * build the per-guest and per-match keys themselves: those keys are derived from
 * values the script reads out of the queue, so they cannot be declared in `KEYS`
 * up front.
 */
export const PREFIX = `${HASH_TAG}:`;

export const KEYS = {
  /** ZSET, member = guestId, score = enqueue time. Score doubles as FIFO order. */
  queue: `${PREFIX}queue`,
  /** ZSET, member = matchId, score = ready-check deadline. Drives the sweeper. */
  matchIndex: `${PREFIX}match:index`,

  /** HASH: name, socketId, instanceId. */
  guest: (guestId: string) => `${PREFIX}guest:${guestId}`,
  /** STRING guestId, keyed by socket, so a disconnect can find who left. */
  socket: (socketId: string) => `${PREFIX}sock:${socketId}`,
  /** STRING matchId, so a disconnect mid-ready-check can be turned into a decline. */
  guestMatch: (guestId: string) => `${PREFIX}guest:${guestId}:match`,
  /** STRING, the match as JSON. Read and rewritten only inside Lua. */
  match: (matchId: string) => `${PREFIX}match:${matchId}`,
} as const;
