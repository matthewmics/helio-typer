/**
 * Starting a race, written as Lua for the same reason as matchmaking's scripts.
 *
 * "Mark this pilot connected, count who is, and set the start if that was the
 * last one" has to be a single step. Two pilots connecting through two
 * instances at the same moment could otherwise both count themselves last and
 * set two different start times, and the race would start twice. Redis runs a
 * script with nothing interleaved, so exactly one join sets the start and is
 * told so, and that is the one that announces it.
 *
 * Start times are numbers of milliseconds on the server clock. `-1` stands in
 * for "not set", since a nil would cut the reply array short.
 */

/**
 * Record a pilot as connected, and start the countdown if they were the last.
 *
 * KEYS: joined set, start key
 * ARGV: pilotId, humans, now, countdownMs, ttlS
 * Returns: { startAt or -1, connected count, 1 if this call set the start }
 */
export const JOIN = `
local joined, startKey = KEYS[1], KEYS[2]
local ttl = tonumber(ARGV[5])

redis.call('SADD', joined, ARGV[1])
redis.call('EXPIRE', joined, ttl)
local count = redis.call('SCARD', joined)

local startAt = redis.call('GET', startKey)
if startAt then return { tonumber(startAt), count, 0 } end

if count >= tonumber(ARGV[2]) then
  local at = tonumber(ARGV[3]) + tonumber(ARGV[4])
  redis.call('SET', startKey, string.format('%d', at), 'EX', ttl)
  return { at, count, 1 }
end
return { -1, count, 0 }
`;

/**
 * Start the countdown whoever is connected, unless it has already started.
 *
 * KEYS: start key
 * ARGV: now, countdownMs, ttlS
 * Returns: { startAt, 1 if this call set it }
 */
export const FORCE_START = `
local startAt = redis.call('GET', KEYS[1])
if startAt then return { tonumber(startAt), 0 } end

local at = tonumber(ARGV[1]) + tonumber(ARGV[2])
redis.call('SET', KEYS[1], string.format('%d', at), 'EX', tonumber(ARGV[3]))
return { at, 1 }
`;
