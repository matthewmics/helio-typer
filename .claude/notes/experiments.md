# Experiments

Things being actively tried out that are not proven conventions yet. **Nothing in
this file is binding.** Only [.claude/rules/](../rules/) and the root `CLAUDE.md`
are project convention.

The distinction from [ideas.md](ideas.md): entries here were proven by code that
actually ran. That does not make them settled, and a finding here only becomes a
rule once it survives the real build.

The spikes that backed these entries lived in `_prototypes/` and were deleted on
2026-08-31, so most of the code links below now point into git history at commit
`c4db0f8` rather than at the working tree. Where an entry has since landed in
the real app it is marked `[LANDED]` and links to the live source instead.

---

## [EXPERIMENTAL] Three-flow netcode

*2026-08-19. Designed in the rating doc (section 4.9), then built as a spike in
`_prototypes/multiplayer/`, which was deleted on 2026-08-31 and survives only in
git history at `c4db0f8`.*

> **This entry is now the specification, not a summary of one.** The three flows
> below never reached `api/`, which has matchmaking and nothing else, so there is
> no working code left to read them off. Rebuild from this text, or recover the
> spike from history first.

**What is being tested:** whether the client can stay instantly responsive while
the server still ends up with a trustworthy number, and whether smoothness comes
from interpolation rather than from raw snapshot rate.

**Every keystroke is validated and applied locally, with no network round trip.**
Correct/wrong, character coloring, hull, speed, and progress are computed
client-side on keydown. This is not optional: at 100+ WPM a key lands roughly
every 120ms, well inside typical WebSocket round-trip time, so gating feedback on
the server would make typing feel sluggish for exactly the players who would
notice most.

Three network flows out of the client, at three different trust levels:

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

## [LANDED] ExcaliburJS port

*Ported into the real app on 2026-08-31. Runs at `/play`, source in
[web/game/](../../web/game/). The original spike at `_prototypes/game/` was
deleted the same day, since the port superseded it entirely.*

Three things differ from that spike, all of them forced by Next rather than
chosen: art is fetched over HTTP from `/game` instead of Vite `?url` imports,
the dev panel is omitted (the markup is simply absent and `Hud` treats every
part of it as optional), and both the engine and the scene's window listener are
torn down on unmount, which the spike never needed because its page owned exactly
one engine for its whole life.

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
- The netcode playground deliberately ran a much shorter `raceDistance` (12 vs
  30), because a prototype you have to type at for three minutes to observe is one
  nobody runs twice. Neither number was a balance decision, and 30 is the one that
  survived into [web/game/config.ts](../../web/game/config.ts).

## [SUPERSEDED] UI mockup

*[undated], built as `_prototypes/ui/ui-mockup.html`, deleted 2026-08-31. The
shell it was sketching is now the real app: see [web/app/](../../web/app/) and
[web/components/](../../web/components/).*

**What it was testing:** the surrounding app shell, rankings page, profile, and
the Hangar with its ship roster.

The Hangar sketched ships with stat-affecting perks (extra hull segment, softened
mistake penalty, decay pause on combo). **That is decided against as of
2026-08-31: ships are cosmetic only.** See
[ideas.md](ideas.md). That copy was carried into the real app, so the perks and
the Thrust / Decay resist / Hull stat bars in
[web/lib/data/ships.ts](../../web/lib/data/ships.ts) are now stale content
contradicting a settled decision, not a design still under consideration.

What is still open in the Hangar is what survives that decision: what
differentiates one ship from another once it cannot be a stat (silhouette, trim,
plume color), whether rarity tiers and credit costs still carry weight with
nothing but appearance behind them, and how a ship panel reads without a stat
block to fill it.
