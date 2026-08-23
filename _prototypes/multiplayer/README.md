# Multiplayer playground

A dockerized spike to answer two questions before committing to the real multiplayer build:

1. What does a six-pilot HelioTyper race actually look like?
2. Does the three-flow netcode described in [.claude/notes/experiments.md](../../.claude/notes/experiments.md) hold up, or does it only sound right on paper?

Nothing here is production code and nothing persists. NestJS + socket.io on the server, ExcaliburJS + Vite on the client, matching the stack in [api/](../../api/).

```
docker compose up -d
```

Then open **http://localhost:3100**. Open it a second time in another tab to add a second human pilot.

Ports are shifted off the main stack (client 3100, server 3101) so this and the repo root `docker-compose.yml` can run at the same time.

## What you should see

Six lanes, one rocket each, climbing toward the heliopause band at the top. Your rocket is the one with the bold name tag and `(you)`. The rest are bots by default, marked with `*`.

Every rocket shows its own thruster plume scaled to current speed, hull pips, and live WPM. Stop typing and watch your plume shrink as decay eats your speed. Make five mistakes and the whole ship greys out with arcs around it for the stall.

Bots exist because a multiplayer prototype you can only evaluate by opening six browser tabs is one nobody evaluates. They run the same `Race` class you do, on the server, and their state reaches your browser through the exact same snapshot stream a remote human's would, so they genuinely exercise the netcode rather than faking it.

## The thing actually worth testing

**Set latency to 150ms, then untick "Interpolate remote pilots."**

Your own rocket does not change at all, because local input never touches the network. Every other rocket starts teleporting a dozen times a second. Tick it back on and they glide again, at the exact same latency and the exact same snapshot rate.

That is the entire argument of section 4.9 in one toggle: smoothness comes from interpolating between snapshots, not from sending more of them. Turning the snapshot rate up to 30Hz with interpolation off looks worse than 12Hz with it on.

Other things the panel makes visible:

- **Packet loss** up to 30%. With interpolation on, moderate loss is nearly invisible, because the buffer has other samples to interpolate through.
- **Interp delay** down to 0. Watch remote rockets start stuttering, because the renderer runs out of buffered future to interpolate toward and falls back to holding the newest sample. This is why rendering slightly in the past is the price of smoothness rather than a bug.
- **Snapshot rate** down to 2Hz with interpolation on. Still surprisingly readable, which is the point.
- **Physics knobs** are the same set as the single player prototype's dev panel, and they push to the server too, so bots re-tune live.

## Architecture

### One simulation, not two

[`shared/race.ts`](shared/race.ts) is lifted almost unchanged from [the single player prototype](../game/src/race.ts), which already kept it free of rendering and DOM specifically so it could run on a server. This playground cashes that in: the same class drives your browser's local pilot and the server's bot pilots.

That matters more than it sounds. Divergence between a client physics implementation and a server one is the entire bug class this design is exposed to, and the cheapest defence is not having two implementations.

The `shared/` folder is mounted into both `server/src/shared` and `client/src/shared` by compose, so both compile against one copy. Plain relative imports were chosen over path aliases or a workspace package because they behave identically under tsc, webpack and Vite, and this code has to compile in two toolchains. In the real build this becomes a proper workspace package.

### Three flows, three trust levels

Defined in [`shared/protocol.ts`](shared/protocol.ts):

| Flow | Message | Rate | Trusted? |
|---|---|---|---|
| 1. Continuous state | `pilot:state` | ~12Hz, tunable | No, cosmetic only |
| 2. Discrete events | `pilot:event` | Immediate on occurrence | No, cosmetic only |
| 3. Keystroke log | `pilot:keys` | Batched every 400ms | Yes, the only scored input |

Flows 1 and 2 are never recorded. A client lying in either makes its own rocket look wrong on other people's screens and nothing else. Flow 3 is what the server replays at race end.

Events are a separate flow from state deliberately. A stall or an ignition reads as instant or reads as broken, with no comfortable middle ground the way there is for continuous position, so they are pushed the moment they happen instead of waiting for the next scheduled snapshot.

### The client is authoritative for feel, never for score

The keydown handler in [`client/src/main.ts`](client/src/main.ts) calls `race.typeKey()` synchronously and the next frame already reflects it. Nothing waits on the socket. At 100+ WPM a key lands roughly every 120ms and a real round trip is 30-80ms, so putting the network in that path would be felt immediately by exactly the players most likely to notice.

The server never asks "what was your WPM." It asks "what did you type and when," and does the arithmetic itself in `Room.results()`. Press **End race + show results** and the table shows the server-derived WPM next to what the client was displaying, so you can see them agree without the server ever having trusted the second number.

This closes the naive "report a big number" cheat. It does not close a client that fabricates a plausible keystroke log, which is the real anti-cheat problem, deliberately parked as out of scope in the rating doc's 4.7.

## What this prototype deliberately does not do

- **No art.** Rockets are drawn with canvas primitives. The generated art in [assets/](../../assets/) is what makes the single player port look the way it does, but the question here is whether six pilots' relative position and state are readable at a glance, and shapes answer that without a 1.5MB heliopause sprite or an asset pipeline inside a container.
- **No camera work.** The real game locks the camera and interpolates the ship toward landmarks. Here progress maps straight to lane position, because relative standing is the thing being evaluated.
- **No matchmaking, no ready check, no persistence.** All parked in the rating doc.
- **No anti-cheat.** See above.

## Known rough edges

- The race auto-starts when the first pilot connects and there is no lobby or countdown, so a second tab joining mid-race joins in progress. Deliberate: a ready check is section 4.8 of the rating doc and not what this spike is testing.
- Placement for a human uses wall clock from race start; bots track their own `wallElapsed`. Both include stall time (unlike WPM, which excludes it), but they are two code paths where the real build should have one.
- Snapshot broadcast is quantised to the server's 120Hz sim tick, so very high snapshot rates land on tick boundaries rather than exactly on the requested Hz.
