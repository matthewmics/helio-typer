# Experiments

Things being actively tried out that are not proven conventions yet. **Nothing in
this file is binding.** Only [.claude/rules/](../rules/) and the root `CLAUDE.md`
are project convention.

The distinction from [ideas.md](ideas.md): entries here have running code you can
open. That does not make them settled. Everything under `_prototypes/` is
explicitly not production code, and a finding here only becomes a rule once it
survives the real build.

---

## [EXPERIMENTAL] Three-flow netcode

*2026-08-19. Designed in the rating doc (section 4.9), then built as a spike in
[_prototypes/multiplayer/](../../_prototypes/multiplayer/).*

**What is being tested:** whether the client can stay instantly responsive while
the server still ends up with a trustworthy number, and whether smoothness comes
from interpolation rather than from raw snapshot rate.

**Every keystroke is validated and applied locally, with no network round trip.**
Correct/wrong, character coloring, hull, speed, and progress are computed
client-side on keydown. This is not optional: at 100+ WPM a key lands roughly
every 120ms, well inside typical WebSocket round-trip time, so gating feedback on
the server would make typing feel sluggish for exactly the players who would
notice most.

Three network flows out of the client, at three different trust levels, defined in
`_prototypes/multiplayer/shared/protocol.ts`:

| Flow | Message | Rate | Trusted? |
|---|---|---|---|
| 1. Continuous state | `pilot:state` | ~12Hz, tunable | No, cosmetic only |
| 2. Discrete events | `pilot:event` | Immediate on occurrence | No, cosmetic only |
| 3. Keystroke log | `pilot:keys` | Batched every 400ms | Yes, the only scored input |

- **Periodic position/speed snapshot**, roughly 10-20Hz. Receiving clients
  interpolate between the last two snapshots rather than snapping to each one, so
  the update rate matters far less than the interpolation and there is no need to
  push at 60Hz. A remote player's thruster plume needs no synced field of its own:
  it is already purely speed-driven, so it falls out of the same rendering code
  once the interpolated speed is available locally.
- **Discrete event stream**, pushed immediately, not on the snapshot cadence:
  launch ignition, stall entered, stall recovered, hull breach, finish. These are
  one-shot animation triggers, and waiting for the next scheduled snapshot would
  make them feel laggy even at a fast snapshot rate, since a state transition
  reads as instant or it reads as broken. There is no comfortable middle ground
  the way there is for continuous position.
- **Timestamped keystroke log**, batched and flushed asynchronously,
  fire-and-forget, never blocking input. At race end the server replays this log
  itself and computes WPM, completion time, and placement from it directly.

The first two flows are purely cosmetic: never recorded, never scored, never
touch the leaderboard. A cheater lying in either one only makes their own rocket
look wrong on other people's screens.

**The distinction that matters:** the client's own on-screen WPM during a race is
a preview of what the server will derive, not the source of truth. The server is
never told "I finished at 87 WPM" and asked to believe it. It is told what
happened, character by character, and does the arithmetic itself. That closes the
naive "just report a big number" cheat without making any input wait on the
network. It does not close a client that fabricates a plausible-looking log, which
is the real anti-cheat problem and is parked in [ideas.md](ideas.md).

**What the spike demonstrates:** set latency to 150ms, then untick "Interpolate
remote pilots." Your own rocket does not change at all, because local input never
touches the network. Every other rocket starts teleporting a dozen times a second.
Tick it back on and they glide again, at the same latency and the same snapshot
rate. 30Hz with interpolation off looks worse than 12Hz with it on. Moderate
packet loss is nearly invisible with interpolation on, because the buffer has
other samples to interpolate through. Dropping interp delay to 0 makes remote
rockets stutter, because the renderer runs out of buffered future and falls back
to holding the newest sample: rendering slightly in the past is the price of
smoothness, not a bug.

## [EXPERIMENTAL] One simulation shared by client and server

*2026-08-19*

**What is being tested:** whether the same `Race` class can drive both the
browser's local pilot and the server's bot pilots, so there is one physics
implementation instead of two that quietly disagree. Divergence between a client
physics implementation and a server one is the entire bug class this design is
exposed to, and the cheapest defence is not having two implementations.

`shared/race.ts` is lifted almost unchanged from the single-player port, which
already kept it free of rendering and DOM specifically so it could run on a
server.

The `shared/` folder is mounted into both `server/src/shared` and
`client/src/shared` by compose so both compile against one copy. Plain relative
imports were chosen over path aliases or a workspace package because they behave
identically under tsc, webpack and Vite, and this code has to compile in two
toolchains. **In the real build this becomes a proper workspace package**, so do
not carry the mount-and-relative-import trick into `api/` or `web/`.

Bots exist because a multiplayer prototype you can only evaluate by opening six
browser tabs is one nobody evaluates. They run the same `Race` class on the
server, and their state reaches the browser through the exact same snapshot stream
a remote human's would, so they genuinely exercise the netcode rather than faking
it.

## [EXPERIMENTAL] ExcaliburJS port

*[undated], in progress at
[_prototypes/game/](../../_prototypes/game/)*

**What is being tested:** the full outbound run to the heliopause on real
generated art, on a real engine, with a particle system and a locked camera.

Mechanics that this port settled are already promoted into
[rules/game-mechanics.md](../rules/game-mechanics.md) and
[rules/game-presentation.md](../rules/game-presentation.md) and are no longer
experimental: the cruise floor, the stall panel treatment, the two-clock `atmo`
renormalisation, `raceDistance` as the single length knob.

Still unsettled here:

- Whether intermediate bodies streaming past with parallax is the right call. See
  the flagged tension in [rules/game-presentation.md](../rules/game-presentation.md).
- The dev panel's tunable physics block is a development affordance, not a
  shipping feature. Its defaults are not balance decisions.
- The playground deliberately runs a much shorter `raceDistance` (12 vs 30). A
  netcode prototype you have to type at for three minutes to observe is one nobody
  runs twice. Do not read either number as a balance decision.

## [EXPERIMENTAL] UI mockup

*[undated],
[_prototypes/ui/](../../_prototypes/ui/)*

**What is being tested:** the surrounding app shell, rankings page, profile, and
the Hangar with its ship roster.

The Hangar sketches ships with stat-affecting perks (extra hull segment, softened
mistake penalty, decay pause on combo). Whether those ship perks exist at all is
unresolved, and it has direct consequences for leaderboard fairness, see
[ideas.md](ideas.md). Nothing in the Hangar has been agreed as a game mechanic.
