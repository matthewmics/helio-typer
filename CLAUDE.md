# HelioTyper

A typing race game: type a stream of sentences correctly to accelerate a rocket
out of the solar system, all the way to the heliopause, the boundary where the
solar wind stalls against interstellar space. Core mechanics are locked.

A pnpm workspace: [api/](api/) (NestJS) and [web/](web/) (Next.js), with
generated sprite art in [assets/](assets/).

The three spikes that used to live in `_prototypes/` were removed on 2026-08-31
once the game landed in `web/`. They are still in git history at commit
`c4db0f8` if a design decision ever needs re-reading. Two of them had already
been superseded, by [web/game/](web/game/) and by the real app shell; the third,
the multiplayer netcode spike, was removed before its ideas reached `api/`, so
[notes/experiments.md](.claude/notes/experiments.md) is now the only description
of that design.

## Core rules, always in force

**Never use em dashes anywhere in any output**: not in prose, code, comments,
docstrings, commit messages, file names, or documentation. No exceptions, not
even "just this once" or in informal contexts. Use a comma, a period (splitting
into two sentences), a colon, parentheses, or a connecting word like "and,"
"but," or "so."

**No AI attribution in git history.** Do not add `Co-Authored-By` trailers,
"Generated with" lines, or any other AI attribution to commit messages or pull
request descriptions. This is a portfolio project, and how AI tooling was used
is disclosed in the README, in the author's own words, not per commit.

**Design lessons locked in.** These were learned by building the thing and are
not up for rediscovery:

- Progress must be speed-driven, not keystroke-driven. Tying progress directly to
  characters typed made the ship feel like it teleported.
- A temporary stall reads better than permanent destruction on hull zero. It
  keeps pressure without ending the session.
- The finish must read as a different kind of object than everything passed en
  route. Every landmark before it is a disc, so the heliopause is a full-width
  boundary instead, to avoid landing as "one more planet."

## Rules

Detailed rules live in [.claude/rules/](.claude/rules/). Load the file that
covers what you are working on.

| File | Covers |
|---|---|
| [game-mechanics.md](.claude/rules/game-mechanics.md) | The simulation: typing, speed and progress, mistakes, hull and stall, WPM, blastoff |
| [game-presentation.md](.claude/rules/game-presentation.md) | Rendering (plain Canvas 2D, no engine, no splash), the outbound run and its landmarks, camera and framing, atmosphere, sky, HUD |
| [matchmaking.md](.claude/rules/matchmaking.md) | Guest identity, the queue and ready check, bot fill, and the rules for running clustered |
| [local-development.md](.claude/rules/local-development.md) | Workspace conventions, hosts file entries, Docker and Traefik routing |
| [prisma.md](.claude/rules/prisma.md) | Prisma v7 gotchas: driver adapter, generate-before-compile, the cjs pin, the rootDir trap |
| [hot-reload.md](.claude/rules/hot-reload.md) | Webpack HMR and polling across the bind mount, and the `allowedDevOrigins` trap |

## Notes

[.claude/notes/](.claude/notes/) holds unsettled thinking:
[ideas.md](.claude/notes/ideas.md) for things discussed but not decided or not
built, [experiments.md](.claude/notes/experiments.md) for things being tried out
in spike code.

**Nothing in notes is project convention.** Only `.claude/rules/` and this file
are binding. Do not implement from notes without asking first, and do not treat a
note as precedent.

## Roadmap

1. ~~Real sprite art now that mechanics are locked.~~ Done, see [assets/](assets/).
2. ~~Port the game into the app: camera lock, particle system, the full outbound
   run to the heliopause.~~ Done, and playable at `/play`, see
   [web/game/](web/game/). It landed on ExcaliburJS and moved to plain Canvas 2D
   on 2026-10-03, see [game-presentation.md](.claude/rules/game-presentation.md).
3. NestJS gateway with a server-authoritative loop, starting single-player against
   the server. The design is written up in
   [notes/experiments.md](.claude/notes/experiments.md); the spike that proved it
   is gone, so this is a rebuild from the notes rather than a port.
4. Multiplayer. Guest matchmaking is built and running in
   [api/src/matchmaking/](api/src/matchmaking/): queue, Dota-style ready check,
   bot fill, clustered over Redis. See
   [matchmaking.md](.claude/rules/matchmaking.md). Still to come: the race itself,
   room codes, countdown, minimap, multiple rockets.
5. Persistence (Postgres/Prisma) for race history and leaderboards.
