# Game mechanics

The simulation: what typing does to the ship. These rules are locked. The
reference implementation is `Race` in [web/game/race.ts](../../web/game/race.ts).

Keep `Race` free of rendering and DOM. It has to run on the server too, and one
physics implementation shared by client and server is the whole defence against
client/server divergence. It currently lives under `web/` only because that is
where the game landed first; the moment the server needs to simulate a pilot it
has to become a workspace package that both `web/` and `api/` import, not a
second copy.

## Typing

- Endless. Sentences are drawn from a pool and keep coming until the player
  reaches the finish. There is no "end of text," so there is no paragraph length
  to pace the race against.
- Never the same sentence twice in a row.
- The sequence is precomputed from a seed rather than drawn lazily, so every
  pilot in a race walks the same list and their WPM is comparable. Mulberry32 is
  used because it is identical across JS runtimes.
- One sentence shown at a time, with per-character coloring for typed, current,
  and pending characters.
- Backspace is unhandled by design. Whether that stays is still open, see
  [notes/ideas.md](../notes/ideas.md).

## Speed and progress

- Each correct keystroke adds `accel` to `speed`, capped at `maxSpeed`.
- `speed` decays continuously via half-life exponential decay (`halfLife`).
- `progress` is purely the integral of speed over time (`speed * dt`
  accumulated), divided by `raceDistance`. Typing never moves the ship directly,
  only speed does.
- `raceDistance` is the single race-length knob.
- Decay bottoms out at a cruise floor (`minSpeed`), not at zero. A true zero is
  reserved for the three states that actually mean it:

  | State | Speed |
  |---|---|
  | Cold on the pad, before the first correct keystroke | 0 |
  | Locked out by a hull-breach stall | 0 |
  | After the finish | 0 |
  | Anything else, including a long pause | `minSpeed` |

- The epsilon clamp (`speed < EPS` becomes 0) and the cruise floor coexist and
  do not conflict: `speedFloor` returns 0 unless the ship is launched and
  racing, so the clamp only bites in the three states above.
- Rationale for the floor: over a full solar-system run a motionless scene reads
  as the game having frozen rather than as lost speed. A mistake still costs
  half of your built-up speed and a long pause bleeds all of it away, but the
  ship keeps ghosting forward at the floor.

## Mistakes and hull

- A wrong keydown fires once: `speed` halves (never below the cruise floor),
  `hull -= 1`, the prompt flashes red, and the ship shakes. The character index
  does not advance.
- Hull reaching zero does not destroy the ship. It stalls instead: input locks
  out, physics freeze, sparks burst, and the prompt goes dead with a live
  countdown (`stallDuration`, 1 second). After the countdown, hull refills,
  speed resets to the cruise floor, and typing resumes on the same character.
- During a stall the whole sentence stays on screen, greyed out, with arcs
  flickering around the panel border and the countdown on a chip straddling the
  panel's top edge. Never hide the text: that is worst exactly when the player
  most wants to see where they will resume.
- Losing outright ("rocket destroyed") is currently unreachable. The only way a
  run ends is by reaching the finish.

## Derived stats

- WPM is elapsed correct characters over elapsed run time, divided by 5.
- Stall time is excluded from that clock. Input is locked out during a stall, so
  no keystrokes could have landed anyway, and counting that time would only drag
  the average down for something the player could not affect.
- Accuracy is correct characters over correct plus mistakes.

## Blastoff

- The ship sits cold on the pad until the first correct keystroke.
- Ignition triggers a brief flame flare (`LAUNCH_DURATION`) that decays into the
  normal speed-driven exhaust plume, plus a billowing smoke cloud, ignition
  sparks, and screen shake.
