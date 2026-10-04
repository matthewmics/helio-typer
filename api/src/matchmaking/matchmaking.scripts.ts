/**
 * The matchmaking state machine, written as Lua so it runs inside Redis.
 *
 * This is the whole answer to "the app is clustered." Every instance runs the
 * same queue tick and the same sweep against the same keys, so the dangerous
 * moments are the ones where two instances act on the same guest at the same
 * instant: both forming a match from an overlapping slice of the queue, both
 * observing the last acceptance and both declaring the match confirmed, both
 * reaping the same expired ready check.
 *
 * Redis runs a script to completion with nothing interleaved, so each of these is
 * a single atomic decision. The read and the write cannot be split by another
 * instance, which is exactly what a read-then-write in TypeScript could not
 * promise no matter how carefully it was written. No distributed lock is needed
 * and none is used: a lock would serialise the same work while adding a lease to
 * expire at the wrong moment.
 *
 * Cross-slot note: these scripts derive per-guest and per-match keys from values
 * read out of the queue, so those keys cannot be declared in KEYS up front. The
 * hash tag on PREFIX is what keeps that legal under Redis Cluster.
 */

/**
 * Try to form one match.
 *
 * Takes a full lobby if the queue holds one. Otherwise takes everyone waiting and
 * fills the rest with bots, but only once the longest waiter has been in line for
 * botFillAfterMs. The bot fill keys off the oldest waiter rather than off a timer
 * per guest, so a guest who joins four seconds into someone else's wait is swept
 * into that match instead of resetting the clock.
 *
 * KEYS: queue, matchIndex
 * ARGV: now, lobbySize, botFillAfterMs, matchId, readyMs, prefix, botNamesJson, seed
 * Returns: the match as JSON, or nil when no match can be formed yet.
 */
export const FORM_MATCH = `
local qk       = KEYS[1]
local idxk     = KEYS[2]
local now      = tonumber(ARGV[1])
local size     = tonumber(ARGV[2])
local botAfter = tonumber(ARGV[3])
local matchId  = ARGV[4]
local readyMs  = tonumber(ARGV[5])
local prefix   = ARGV[6]

local rows = redis.call('ZRANGE', qk, 0, size - 1, 'WITHSCORES')
if #rows == 0 then return nil end

local ids, scores = {}, {}
for i = 1, #rows, 2 do
  ids[#ids + 1] = rows[i]
  scores[#scores + 1] = tonumber(rows[i + 1])
end

-- scores[1] is the oldest waiter: ZRANGE returns ascending by score, and the
-- score is the enqueue time.
if #ids < size and (now - scores[1]) < botAfter then return nil end

local players = {}
for i = 1, #ids do
  local g = redis.call('HMGET', prefix .. 'guest:' .. ids[i], 'name', 'socketId')
  players[#players + 1] = {
    id = ids[i],
    name = g[1] or 'pilot',
    socketId = g[2] or '',
    bot = false,
    status = 'pending',
    score = scores[i],
  }
end

-- Bots are pre-accepted. There is no socket to prompt, so leaving them pending
-- would deadlock every ready check they appear in.
local botNames = cjson.decode(ARGV[7])
for i = 1, size - #ids do
  players[#players + 1] = {
    id = 'bot:' .. matchId .. ':' .. i,
    name = botNames[i],
    socketId = '',
    bot = true,
    status = 'accepted',
    score = 0,
  }
end

redis.call('ZREM', qk, unpack(ids))

local deadline = now + readyMs
local match = {
  id = matchId,
  createdAt = now,
  deadline = deadline,
  state = 'open',
  seed = tonumber(ARGV[8]),
  players = players,
}
local blob = cjson.encode(match)

-- The match key outlives its deadline by a margin, so a slow sweep still finds
-- something to read rather than a hole.
redis.call('SET', prefix .. 'match:' .. matchId, blob, 'PX', readyMs + 30000)
redis.call('ZADD', idxk, deadline, matchId)
for i = 1, #ids do
  redis.call('SET', prefix .. 'guest:' .. ids[i] .. ':match', matchId, 'PX', readyMs + 30000)
end

return blob
`;

/**
 * Record one pilot's accept or decline, and resolve the match if that settles it.
 *
 * The whole reason this is a script: "mark accepted, count who is still pending,
 * confirm if nobody is" has to be indivisible. Two instances running that as
 * three round trips can both see zero pending and both start the race.
 *
 * A decline fails the match immediately, Dota style, and returns everyone who did
 * not decline to the queue at their original score so they keep their place in
 * line rather than being punished for someone else bailing.
 *
 * KEYS: queue, matchIndex
 * ARGV: matchId, guestId, action, prefix
 * Returns: JSON with an outcome and, when there is one, the match.
 */
export const DECIDE = `
local qk      = KEYS[1]
local idxk    = KEYS[2]
local matchId = ARGV[1]
local guestId = ARGV[2]
local action  = ARGV[3]
local prefix  = ARGV[4]
local mk      = prefix .. 'match:' .. matchId

local blob = redis.call('GET', mk)
if not blob then return cjson.encode({ outcome = 'gone' }) end

local m = cjson.decode(blob)
if m.state ~= 'open' then return cjson.encode({ outcome = 'closed' }) end

local me = nil
for _, p in ipairs(m.players) do
  if p.id == guestId then me = p end
end
if me == nil then return cjson.encode({ outcome = 'not_in_match' }) end

if action == 'decline' then
  me.status = 'declined'
  m.state = 'failed'
  m.reason = 'declined'
  for _, p in ipairs(m.players) do
    if not p.bot then
      if p.status ~= 'declined' then
        p.requeued = true
        redis.call('ZADD', qk, p.score, p.id)
      else
        p.requeued = false
      end
      redis.call('DEL', prefix .. 'guest:' .. p.id .. ':match')
    end
  end
  redis.call('ZREM', idxk, matchId)
  redis.call('DEL', mk)
  return cjson.encode({ outcome = 'failed', match = m })
end

me.status = 'accepted'

local pending = 0
for _, p in ipairs(m.players) do
  if p.status == 'pending' then pending = pending + 1 end
end

if pending > 0 then
  redis.call('SET', mk, cjson.encode(m), 'KEEPTTL')
  return cjson.encode({ outcome = 'accepted', match = m })
end

-- Everyone is in. Drop it out of the sweeper's index first, so an expiry landing
-- in the same millisecond cannot also claim it.
m.state = 'confirmed'
redis.call('ZREM', idxk, matchId)
redis.call('SET', mk, cjson.encode(m), 'KEEPTTL')
return cjson.encode({ outcome = 'confirmed', match = m })
`;

/**
 * Reap ready checks whose deadline passed.
 *
 * Every instance sweeps. The ZREM inside the loop is what makes that safe: the
 * first instance to reach a given matchId takes it out of the index, so a second
 * instance sweeping in the same millisecond finds nothing to do for it.
 *
 * Pilots who accepted go back in the queue at their original score. Pilots who
 * never answered are dropped, which is the entire point of a ready check: it
 * exists to catch the player who walked away from the keyboard.
 *
 * KEYS: matchIndex, queue
 * ARGV: now, prefix, batch
 * Returns: an array of failed matches as JSON.
 */
export const SWEEP_EXPIRED = `
local idxk   = KEYS[1]
local qk     = KEYS[2]
local now    = tonumber(ARGV[1])
local prefix = ARGV[2]
local batch  = tonumber(ARGV[3])

local ids = redis.call('ZRANGEBYSCORE', idxk, '-inf', now, 'LIMIT', 0, batch)
local out = {}

for _, matchId in ipairs(ids) do
  if redis.call('ZREM', idxk, matchId) == 1 then
    local mk = prefix .. 'match:' .. matchId
    local blob = redis.call('GET', mk)
    if blob then
      local m = cjson.decode(blob)
      if m.state == 'open' then
        m.state = 'failed'
        m.reason = 'timeout'
        for _, p in ipairs(m.players) do
          if not p.bot then
            if p.status == 'accepted' then
              p.requeued = true
              redis.call('ZADD', qk, p.score, p.id)
            else
              p.status = 'timeout'
              p.requeued = false
            end
            redis.call('DEL', prefix .. 'guest:' .. p.id .. ':match')
          end
        end
        out[#out + 1] = cjson.encode(m)
      end
      redis.call('DEL', mk)
    end
  end
end

return out
`;
