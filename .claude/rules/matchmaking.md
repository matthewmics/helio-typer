# Matchmaking

The queue, the ready check, and bot fill. Lives in
[api/src/matchmaking/](../../api/src/matchmaking/), with the Redis wiring in
[api/src/redis/](../../api/src/redis/). This is production code, not a spike.

## Guests

- **Guest-only for now.** Every pilot is a guest with a server-generated
  callsign. There are no accounts, so nothing here reads or writes `User`.
- **Guests race guests.** Trivially true today because guests are all there is.
  When accounts arrive this becomes a real constraint, and the place it goes is
  the queue key: one queue per audience, not a filter applied after popping. A
  filter would let a mixed lobby form and then have to unform it.
- **Guests never appear on the leaderboard.** They accumulate no history and
  qualify for nothing. This is what lets guest play exist without an anti-cheat
  story: there is no rank to defend.
- A guest identity is not an authentication boundary. `resumeToken` exists only
  so a page refresh keeps the same callsign, and it is deliberately not the
  `guestId`, which is broadcast to every opponent in the roster.
- Callsigns carry a numeric suffix so they need no cluster-wide reservation. A
  duplicate callsign is cosmetic. A names set in Redis would need a release path
  on every disconnect and would leak an entry every time a process died between
  the two.

## The flow

```
queue:join -> waiting -> match:found -> everyone accepts -> match:confirmed
                            |                                     |
                            +-> someone declines or times out      +-> race
                                     -> match:failed
```

- Lobby is 6. A full queue matches instantly.
- **Bots fill after 5 seconds**, measured from the *oldest* waiter, not per
  guest. A guest arriving four seconds into someone else's wait joins that match
  rather than resetting the clock.
- Bots are created pre-accepted. There is no socket to prompt, so a pending bot
  would deadlock every ready check it appeared in.
- **Each bot flies its own ship**, assigned in the race record when the match is
  confirmed (`seatShips` in `api/src/race/bot.ts`). It is shuffled from the match
  seed, never the default and never the same ship twice, so a field of bots
  reads as different pilots. Humans fly the default for now. The ship list
  itself lives in `@heliotyper/engine`, the one package both sides import.
- Ready check is 15 seconds, Dota style, with a live accepted count.
- **A decline fails the match immediately.** Everyone who did not decline goes
  back in the queue at their *original* score, so they keep their place in line
  and their accumulated wait instead of being punished for someone else bailing.
- **A timeout drops the pilot who never answered** and requeues the ones who
  accepted. Catching the player who walked away is the entire purpose of a ready
  check, so it cannot also forgive them.
- A disconnect during a ready check is treated as a decline. Waiting out the
  timer would hold five people on a prompt for a browser that is already closed.

Timings are in `matchmaking.config.ts`. They are policy, not physics, and none of
them belong in the shared race config.

## The start

- **Nobody races until everybody is in.** Each human's `race:join` marks them
  connected, and the last one in sets a single start 3 seconds out
  (`COUNTDOWN_MS`). Every pilot's keys and every bot go on that one start. It
  used to be the first arrival, which handed the bots and whoever's page loaded
  first a head start.
- Marking a pilot connected and setting the start is one Lua script
  (`race.scripts.ts`), so two pilots connecting through two instances cannot
  both set it. Only the call that set it announces it (`race:countdown`).
- **A pilot who never connects is waited on for 15 seconds** from confirmation
  (`JOIN_TIMEOUT_MS`), then the race starts without them and they place as a
  DNF.
- **Finishes are timed from that shared start**, by whichever instance the
  pilot is connected to, and announced to the room once (`race:finish`). That
  is what lets every client's live standings agree on the order, and what lets
  the owner end a race whose pilots are spread across instances.

Timings are in `api/src/race/race.config.ts`.

## Running clustered

The app is meant to run as more than one process. Three rules keep that working,
and all three are easy to break by accident.

1. **No matchmaking state in process memory.** Queue, ready checks and guest
   identities live in Redis keys. A `Map` on a service would work perfectly until
   the second instance started, at which point there would be two queues that
   never see each other. The only local state allowed is
   `MatchmakingGateway.local`, which caches facts about *this instance's own
   sockets* and is worthless to anyone else.

2. **Every read-then-write goes through Lua.** See the header of
   `matchmaking.scripts.ts`. "Mark accepted, count who is still pending, confirm
   if nobody is" has to be indivisible or two instances both start the same race.
   Redis runs a script to completion with nothing interleaved, which is why there
   is no distributed lock anywhere in this feature and should not be one.

3. **Know which emits are cluster-wide and which are local.**

   | Emit | Scope | Why |
   |---|---|---|
   | Match found, progress, confirmed, failed | `server.to(socketId)`, cluster-wide | Exactly one instance holds the event, because the script handed it to exactly one caller |
   | Periodic queue status | this instance's own sockets | Every instance runs the timer, so a cluster-wide emit would deliver one copy per instance |

   Getting this backwards produces duplicate prompts or silence, and both look
   like a client bug.

**Do not broadcast to a room immediately after `socketsJoin`.** Under the Redis
adapter `socketsJoin` publishes a request and every instance acts on it when the
message comes back through pub/sub. The await resolves when the request is
published, not when anyone has joined, so a broadcast on the next line races the
round trip and lands in an empty room. `announceConfirmed` emits per socket for
exactly this reason. This is not hypothetical: it silently swallowed every
confirmation until a two-guest run caught it.

**Transport is WebSocket only**, set in `RedisIoAdapter.createIOServer`. socket.io's
HTTP long-polling transport spreads one logical connection over many HTTP
requests, so behind a load balancer it needs sticky sessions. A raw WebSocket is
one connection to one instance for its whole life and needs none. If polling is
ever re-enabled, Traefik needs a sticky cookie on the api service or matchmaking
will break in ways that look random.

Redis keys all carry the `{mm}` hash tag. On a single Redis that changes nothing.
It is there so the multi-key scripts stay legal if Redis itself is ever clustered.

## Verifying it

There is no automated check right now. The socket-client harness that used to
drive these flows (`api/tools/mm-sim.mjs`) was removed on 2026-10-04, with a
better way to test and simulate planned for later, possibly alongside the admin
site. It is still in git history at commit `a6f311e` if it is needed before then.

Until that exists, remember that the cross-instance path only breaks with two or
more api instances running. A single-instance test, manual or otherwise, does
not exercise it.
