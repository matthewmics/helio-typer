/** Injection token for the shared ioredis connection. */
export const REDIS = Symbol('REDIS');

/**
 * Every matchmaking key carries the `{mm}` hash tag.
 *
 * On a single Redis this changes nothing. On Redis Cluster it forces every key
 * this feature touches into one hash slot, which is what makes the multi-key Lua
 * scripts in `matchmaking.scripts.ts` legal: a script that reads the queue and
 * writes a match key would otherwise be rejected as a cross-slot operation. The
 * app is the thing being clustered here, not Redis, but paying this now costs
 * nothing and avoids a rewrite if Redis is clustered later.
 */
export const HASH_TAG = '{mm}';
