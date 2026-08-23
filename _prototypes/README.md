# Prototypes

Throwaway spikes, each built to answer one question before committing to it in
the real build. **None of this is production code.** Nothing here is imported by
[api/](../api/) or [web/](../web/), and nothing here is a convention.

What each one settled has already been promoted into
[.claude/rules/](../.claude/rules/). What is still open lives in
[.claude/notes/experiments.md](../.claude/notes/experiments.md). Read those
rather than inferring current design from whatever this code happens to do.

| Folder | Question it answers | Still worth opening? |
|---|---|---|
| [game/](game/) | Does the whole outbound run work on a real engine with real art? | Yes, this is the live single-player port |
| [multiplayer/](multiplayer/) | Does the three-flow netcode hold up, and what does a six-pilot race look like? | Yes, for the netcode argument |
| [ui/](ui/) | What do the surrounding pages look like: rankings, profile, hangar? | Reference only, a static mockup |

## Running them

Each is independent, with its own toolchain and its own install. None are part of
the root pnpm workspace.

```
cd game && npm install && npm run dev      # http://localhost:5173
cd multiplayer && docker compose up -d     # http://localhost:3100
open ui/ui-mockup.html                     # no build step, it is one HTML file
```

The multiplayer spike runs on shifted ports (client 3100, server 3101) so it and
the root `docker-compose.yml` can be up at the same time.

## Known rough edges

Recorded so nobody rediscovers them:

- **The simulation has forked.** `game/src/race.ts` and
  `multiplayer/shared/race.ts` started as one file and have since drifted by
  roughly 127 lines (`text.ts` by another 105). Some of that is deliberate, the
  seeded sentence sequence multiplayer needs. Some is plain drift. This is
  awkward, because avoiding exactly this divergence is the argument the
  multiplayer spike exists to make. Extracting `shared/` into a real workspace
  package is the fix, and is not done yet.
- **`game/` is on npm** (it has a committed `package-lock.json`) while the rest
  of the repo is pnpm.
- **`ui/ui-mockup.html`** was previously named `web-prototype.jsx`, which it never
  was: it is a standalone HTML document, not a React component.
