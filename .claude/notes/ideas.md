# Ideas

Discussed but not decided, or decided but not built. **Nothing in this file is
binding.** Only [.claude/rules/](../rules/) and the root `CLAUDE.md` are project
convention. Treat everything here as a starting point for a conversation, not as
a spec to implement.

Source: migrated from `_claude-discussions/rating-mechanics-and-matchmaking.md`
(revision 5), committed 2026-08-19 and since removed. Its own status vocabulary
was `[settled]` / `[proposed]` / `[open]`; those original tags are preserved
inline where they carry information.

---

## [DECIDED] Ships are cosmetic only

*2026-08-31. Closes the open question carried in
[experiments.md](experiments.md) about the Hangar's stat-affecting perks.*

Ships change how the rocket looks and nothing else. No extra hull segment, no
softened mistake penalty, no decay pause on combo, no thrust or decay-resist
differences. Every pilot in every race flies identical physics, whatever is in
their hangar.

- **Why**: a purchasable or unlockable stat is a second variable in a number the
  whole game is built to measure. Completion time and WPM only mean something if
  the only thing that differs between two runs is the typing, and the leaderboard
  fairness problem this creates has no clean fix, only mitigations (flagging
  perk-assisted races, separate boards, balance passes) that all cost more than
  the perks were ever worth.
- **What it buys**: ships stay a pure reward track. They can be handed out for
  credits, quests, or milestones as freely as the design wants, with no balance
  review and no leaderboard consequence, because nothing they do can affect a
  result.
- **What still needs designing**: what makes one ship desirable over another with
  stats off the table. Silhouette, trim and palette, plume and exhaust treatment,
  rarity as a flex rather than as power.
- **Not decided here**: whether ships cost credits, how they are unlocked, or
  whether the rarity tiers in the mockup survive.
- **Update 2026-10-04**: settled for now by keeping the portfolio build simple.
  No credits anywhere in the UI, no rarity, and every ship is open to every
  pilot. The roster is the twelve rockets in `assets/rockets/`, each its own
  silhouette and exhaust colour. Equipping is still local to the hangar: every
  pilot in a race flies the Vanguard until the race roster carries a ship.

---

## [PROPOSED] Fastest Completion leaderboard, v1

*2026-08-19. Tagged `[settled]` in the source doc, but nothing is implemented:
`api/prisma/schema.prisma` still has only `User`. Settled as a direction, not as
shipped behavior.*

One leaderboard, scored as a player's **average completion time across their own
most recent 10 qualifying races**, ascending.

- **Why average, not best-of-window**: taking the minimum of the window does not
  actually average out luck, since `MIN` grabs the single best value no matter
  how many races fed into it, so the eligibility floor would be doing all the
  anti-luck work by itself. Averaging does that work directly: one outlier race,
  good or bad, gets diluted by the other nine.
- **Eligibility floor**: at least 10 qualifying races total before appearing on
  the board. Same number as the window size for a reason: an average over fewer
  than 10 races is a noisier statistic, and the floor guarantees every entry
  represents a full window.
- **Why rolling instead of all-time**: an all-time record set once, months ago,
  by a player who no longer plays sits at #1 forever with nothing to dislodge
  it, which is a dead end in a small-playerbase game. A rolling last-10 average
  means a player has to keep performing to stay near the top. This does the job
  the parked calendar-windowing idea was reaching for, anchored to race count
  instead of calendar time, and it needs no extra UI.
- **Qualification per race**: must finish (no DNF), standard queue settings only,
  not a custom private-room config. A DNF or non-standard race has no comparable
  completion time, so it neither consumes a "last 10" slot nor counts toward the
  10-race threshold.
- **Guests never qualify.** Decided 2026-08-31 and now enforced by the fact that
  guests have no account to hang a history on. See
  [rules/matchmaking.md](../rules/matchmaking.md).
- **Table columns**: Rank, Pilot, Avg completion time, Avg WPM, Most-used ship,
  Avg accuracy, all computed over the same last-10 window, so every column in a
  row describes the same set of races. Ship cannot be literally averaged;
  "most-used in the window" is the stand-in.
- **Showing the ship is flavor, not a performance signal.** Ships are cosmetic
  only, so the column says something about a pilot's taste and nothing about an
  advantage. This bullet previously argued the column for transparency, on the
  grounds that a stat-affecting perk should at least be visible in the row. That
  reason is gone; whether the column still earns its width is now an open
  question below.

## [PROPOSED] Race persistence schema sketch

*2026-08-19*

```prisma
model Race {
  id           String   @id @default(uuid())
  mode         RaceMode
  standard     Boolean  @default(true)  // false for private-room custom configs
  raceDistance Float                    // must be fixed for standard races or completion times aren't comparable
  createdAt    DateTime @default(now())
  finishedAt   DateTime?
  participants RaceParticipant[]
}

model RaceParticipant {
  id                String  @id @default(uuid())
  raceId            String
  userId            String
  shipId            String  // which ship was flown, shown on the board
  placement         Int     // 1-based; DNF sorts last, still recorded for profile history
  dnf               Boolean @default(false)
  wpm               Float
  accuracy          Float
  completionMs      Int?    // null if dnf
  hullBreaches      Int
  qualifiesForBoard Boolean @default(false)  // finished + standard settings

  @@unique([raceId, userId])
}
```

Note: the original sketch called this field `moonDistance`, a leftover from when
the moon was the finish line. Renamed here to match the gameplay config, where
the knob is `raceDistance`.

The board itself is a query, not a stored table: per user, take their most recent
10 `qualifiesForBoard` rows ordered by `race.finishedAt` descending, then
`AVG(completionMs)`, `AVG(wpm)` and `AVG(accuracy)` across those 10, plus the
most frequent `shipId` among them, then rank all eligible users (10+ qualifying
races) by the average ascending. The "most frequent ship" part needs a small
group-and-count over the same 10 rows rather than a plain aggregate, cheap at
this scale, either in the query or in application code. Only worth caching a
per-user summary row if read volume ever makes the live query slow.

Profile wins is `count(*) where placement = 1`, shown on the profile only, not as
its own leaderboard.

## [PROPOSED] UI implications for the web prototype

*2026-08-19. Written against `_prototypes/ui/ui-mockup.html`, since deleted; the
same pages now exist for real under [web/app/](../../web/app/).*

- **Rankings page is a single table**, not tabs. Columns:
  `# / Pilot / Avg completion time / Avg WPM / Most-used ship / Avg accuracy`.
  Drop the Global/Week/Friends/Country tab row and the podium/tier language from
  earlier revisions, none of it applies.
- **Below-threshold players need a visible state**, not just an absence.
  Something like "6 of 10 races completed" on their own profile, so the
  eligibility floor reads as a goal rather than a silent exclusion.
- **Profile page** keeps the race history feed and "Races won" tile, plus one
  more tile for the player's own current last-10 average completion time, so they
  can see where they would land without opening the board.
- **Results screen** still does not exist and is still the first thing to build.
  It shows completion time, WPM, ship flown, placement, and how the race moved
  the player's rolling average, up or down, or a callout if it is now their best
  average ever recorded.
- **No ranked mode, no skill-based matchmaking.** The queue fills a lobby up to 6
  and waterfalls down to fewer after a timeout.

---

## [UNDER DISCUSSION] Open questions carried from CLAUDE.md

*[undated], predates the discussion doc*

- Backspace behavior.
- Whether difficulty tiers change decay rate, hull, or race distance.
- Matchmaking model: room codes vs public quick-match. **Note:** this partially
  conflicts with the leaderboard doc above, which assumes a 6-player waterfall
  queue with no ranked mode. Unresolved across the two documents.
- Whether hull regenerates outside of stall recovery.

## [UNDER DISCUSSION] Open questions from the rating doc

*2026-08-19*

- Is `raceDistance` fixed for the standard queue, or could it become a per-lobby
  setting? The whole leaderboard depends on the answer, since it is a wall-clock
  time.
- Minimum players to start a race without a rating system to justify a wait:
  3? 4?
- Backspace behavior, since it affects WPM measurement, which is a displayed
  leaderboard column.
- Tie-breaking when two players post the exact same average completion time:
  accuracy, or earliest-achieved?
- Does the 10-race eligibility floor get raised or lowered once there is real
  data on how long 10 races takes an average player?
- Is "most-used ship in the window" the right stand-in, or should it show the
  currently-equipped ship, or drop the column? Sharper now that ships are
  cosmetic only: the column is decoration on a table of measurements, so it
  either earns its place as flavor or it goes.

---

## Parked, not dropped

*2026-08-19. Kept in enough detail to resume without re-deriving.*

### [UNDER DISCUSSION] Matchmaking rating (Elo-style)

Start at 1500. Pairwise-decomposed Elo across the lobby, so placement-based
gain/loss (top half gains, bottom half loses, extremes swing more) emerges from
the math instead of a hand-tuned table, and beating a higher-rated opponent is
worth more than beating a lower-rated one:

```
for each pair (i, j) in the lobby:
    expected_i = 1 / (1 + 10^((rating_j - rating_i) / 400))
    actual_i   = 1 if i placed better than j else 0
    delta_i   += (K / (n-1)) * (actual_i - expected_i)
```

K = 32 to start, flat. Floor the rating around 100 so it cannot go negative.

### [UNDER DISCUSSION] Skill-based matchmaking bands

Bands must be multiplicative (percentage of rating), not a flat WPM window, since
race time scales with `1 / speed` and closeness is a ratio, not a difference
(20 vs 30 WPM is a blowout, 100 vs 110 is close, same 10 WPM gap).

```
band = max(rating * pct, 5)   // flat floor of 5 WPM

t=0s    pct=0.12
t=10s   pct=0.20
t=20s   pct=0.30
t=30s   pct=0.45   + allow starting at 4 players
t=45s   pct=0.70   + allow starting at 3, or bots
```

### [UNDER DISCUSSION] Credits and Top Earners board

Existing in-game currency, extended into a leaderboard ranked by total earned
(not current balance, so spending on ships does not drop your rank), fed by daily
tasks and quests. Explicitly the "played a lot" track, meant to coexist with a
skill-measured board rather than compete with it. Needs a `CreditTransaction`
ledger (amount, reason, timestamp) rather than a mutable balance field, so "total
earned" is a sum that spending cannot corrupt.

### [UNDER DISCUSSION] Divisions / tiers

Named bands of rating using the outbound run (`Suborbital -> ... -> Heliopause`),
with existing art in `assets/planets/`. Only useful once there is a rating number
to bucket. Open whether they are worth keeping as pure cosmetic flavor even
without a leaderboard behind them.

### [UNDER DISCUSSION] Seasons

A seasonal reset requires something that resets, i.e. a rating or points total.
Parked along with the Elo and credits ideas above.

### [UNDER DISCUSSION] Integrity gating for the leaderboard

Beyond "finished on standard settings": a minimum accuracy floor, and
server-verified keystroke timing rather than trusting client-reported WPM. This
previously also had to cover disqualifying or flagging races flown with a
stat-affecting ship perk; that requirement is gone now that ships are cosmetic
only, so purchased power cannot inflate a leaderboard time in the first place.

**Real anti-cheat is explicitly out of scope for v1.** Keystrokes are validated
client-side for feel, because input has to be local-authoritative or fast typists
feel every round trip. That means a modified client can lie to the server, and
the keystroke-log-replay pipeline only makes the *reported numbers* internally
consistent, not necessarily *true*. Full anti-cheat (replaying keystrokes against
the actual assigned sentence server-side, statistical outlier detection across
the playerbase, rate-limiting, a reporting/trust system) is a project of its own
and is not worth building against a threat model where nothing but a leaderboard
row is at stake. Worth building the log pipeline anyway, since it is the exact
infrastructure real anti-cheat would need later, so deferring the detection logic
does not mean deferring the plumbing.

### [UNDER DISCUSSION] Ready check queue flow (Dota style)

Match found modal, 15 second accept timer, live "4 of 6 accepted" counter, gentle
decline penalties (first free, then short cooldowns). Independent of rating and
worth keeping as the eventual queue UX.

---

## [REJECTED] Superseded scoring models

*2026-08-19. Recorded so they are not re-proposed from scratch. Each was replaced
for a specific reason.*

- **Hidden Elo as the player-facing score** (revision 1). Replaced by measured
  WPM, on the grounds that a hidden number cannot motivate.
- **Seasonal Season Points ladder** (revision 1, removed in revision 2). A
  no-loss monotonic points total scoped per division. Removed because volume
  beats skill in any monotonic total: it can be ground out.
- **Peak WPM as the headline board** (revision 2, removed in revision 3).
- **Two separate all-time boards, Best WPM and Fastest Completion** (revision 3,
  collapsed in revision 4). Collapsed to one board with WPM as a column.
- **Best-of-window scoring** (revision 4, replaced in revision 5). `MIN` ignores
  everything but the single best race regardless of window size, so it does not
  average out luck and left the eligibility floor doing all the anti-luck work
  alone.
- **Calendar-windowed leaderboard (day/week/month)**. Superseded in spirit by
  rolling-last-10, which solves the same staleness problem without separate tabs.
  Worth reviving only if race-count windowing feels wrong in practice, e.g. if
  very active players' windows roll over too fast to feel stable.
