import type { Phase } from '@heliotyper/engine';

/**
 * The in-race wire protocol, and with it the trust boundary from the three-flow
 * netcode design in .claude/notes/experiments.md.
 *
 * Three flows out of the client, kept as three message types rather than one
 * combined update, because they have genuinely different timing and trust
 * properties:
 *
 *   1. `pilot:state`  continuous, ~12Hz, cosmetic, interpolated on receipt
 *   2. `pilot:event`  discrete, sent the instant it happens, cosmetic
 *   3. `pilot:keys`   batched keystroke log, the only thing that is ever scored
 *
 * Flows 1 and 2 are never scored. A client lying in either one makes its own
 * rocket look wrong on other people's screens and nothing else.
 */

/** Everything one pilot's rocket needs to be drawn by somebody else's browser. */
export interface PilotState {
  /** Sender's clock. Without a timestamp per sample the receiver has no basis
   *  for placing a snapshot in time and can only snap to whatever arrived last. */
  t: number;
  progress: number;
  speed: number;
  speedRatio: number;
  tier: number;
  hull: number;
  phase: Phase;
  launched: boolean;
  launchT: number;
  wpm: number;
  stallTimer: number;
}

/** One-shot animation triggers. Pushed immediately, never held for a snapshot. */
export type PilotEventKind = 'launch' | 'mistake' | 'breach' | 'recover' | 'finish';

export interface PilotEventMsg {
  kind: PilotEventKind;
  t: number;
}

/**
 * Flow 3. One entry per keydown: which character index it was aimed at, what was
 * expected there, what actually arrived, and when.
 *
 * Enough for the server to replay a run independently rather than take the
 * client's word for a final WPM. Not yet used for scoring, see the note on
 * {@link ResultRow}.
 */
export interface KeyEvent {
  i: number;
  expected: string;
  got: string;
  t: number;
}

export interface PilotKeysMsg {
  keys: KeyEvent[];
}

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------

export interface RacePilotInfo {
  id: string;
  name: string;
  /** Fixed column for this pilot, 0-based. Decides where their rocket sits. */
  lane: number;
  isYou: boolean;
}

export interface RaceWelcomeMsg {
  matchId: string;
  youId: string;
  /** Drives the sentence sequence, so every pilot types the same list. */
  seed: number;
  pilots: RacePilotInfo[];
  /** How often the server pushes bot state, so the client can size its buffer. */
  snapshotHz: number;
}

/**
 * A partial snapshot: whatever pilots this message has news about.
 *
 * Deliberately partial rather than the whole field every time. A human's state is
 * relayed straight to the room by whichever instance received it, and the
 * instance that owns the match broadcasts its bots together. Merging by id on the
 * client means neither sender has to know about the other, which is what keeps
 * this working with the pilots spread across several processes.
 */
export interface RaceSnapshotMsg {
  t: number;
  pilots: Record<string, PilotState>;
}

export interface RaceEventMsg {
  id: string;
  kind: PilotEventKind;
  t: number;
}

/**
 * Final standings.
 *
 * `wpm` and `accuracy` are currently the pilot's own reported numbers, not
 * numbers the server derived by replaying flow 3. That replay is the point of
 * collecting the keystroke log and is the next thing to build here; until then
 * these results are honest about being client-reported. Guests are barred from
 * the leaderboard, so nothing is riding on them yet.
 */
export interface ResultRow {
  id: string;
  name: string;
  placement: number;
  wpm: number;
  accuracy: number;
  completionMs: number | null;
  progress: number;
  dnf: boolean;
}

export interface RaceResultsMsg {
  matchId: string;
  rows: ResultRow[];
}

export const RACE_EVENTS = {
  // client -> server
  join: 'race:join',
  pilotState: 'pilot:state',
  pilotEvent: 'pilot:event',
  pilotKeys: 'pilot:keys',

  // server -> client
  welcome: 'race:welcome',
  snapshot: 'race:snapshot',
  event: 'race:event',
  results: 'race:results',
} as const;
