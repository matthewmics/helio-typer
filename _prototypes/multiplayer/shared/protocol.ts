import type { BotConfig, NetConfig, RaceConfig } from './config';
import type { Phase } from './race';

/**
 * The wire protocol, and with it the trust boundary from the three-flow netcode
 * design in .claude/notes/experiments.md.
 *
 * Three flows out of the client, deliberately kept as three separate message
 * types rather than one combined update, because they have genuinely different
 * timing and trust properties:
 *
 *   1. `pilot:state`  continuous, ~12Hz, cosmetic, interpolated on receipt
 *   2. `pilot:event`  discrete, sent the instant it happens, cosmetic
 *   3. `pilot:keys`   batched keystroke log, the only thing that is ever scored
 *
 * Flows 1 and 2 are never recorded. A client lying in either one makes its own
 * rocket look wrong on other screens and nothing else. Flow 3 is what the server
 * replays at race end to derive the authoritative result, so it is the only
 * message whose contents end up anywhere that matters.
 */

// ---------------------------------------------------------------------------
// Client -> server
// ---------------------------------------------------------------------------

export interface JoinMsg {
  name: string;
}

/**
 * Flow 1. Continuous state, cosmetic only.
 *
 * `t` is the client's send timestamp, which is what makes interpolation on the
 * receiving end possible: without a timestamp per sample the receiver has no
 * basis for placing a snapshot in time and can only snap to whatever arrived last.
 */
export interface PilotStateMsg {
  t: number;
  progress: number;
  speed: number;
  tier: number;
  hull: number;
  phase: Phase;
  wpm: number;
  stallTimer: number;
}

/** Flow 2. One-shot animation triggers, pushed immediately, never batched. */
export type PilotEventKind = 'launch' | 'mistake' | 'breach' | 'recover' | 'finish';

export interface PilotEventMsg {
  kind: PilotEventKind;
  t: number;
}

/**
 * Flow 3. The only client message that feeds a result.
 *
 * One entry per keydown: which character index it was aimed at, what was expected
 * there, what actually arrived, and when. Enough for the server to replay the run
 * independently rather than take the client's word for a final WPM.
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

export interface WelcomeMsg {
  playerId: string;
  seed: number;
  config: RaceConfig;
  net: NetConfig;
}

export interface PilotInfo {
  id: string;
  name: string;
  isBot: boolean;
  isYou: boolean;
  lane: number;
}

export interface LobbyMsg {
  pilots: PilotInfo[];
}

export interface StartMsg {
  seed: number;
  /** Server clock at start, so clients can express positions on a shared timeline. */
  t: number;
}

/**
 * The aggregated broadcast: every pilot's latest state, sent at `snapshotHz`.
 *
 * One message for the whole lobby rather than one per pilot. At six pilots the
 * difference is small, but it means the receiving client always has a complete,
 * mutually consistent picture of the field at a single instant, which is what
 * interpolating between two of them requires.
 */
export interface SnapshotMsg {
  t: number;
  pilots: Record<string, PilotStateMsg>;
}

export interface RelayEventMsg {
  id: string;
  kind: PilotEventKind;
  t: number;
}

/**
 * The server's own derived result, computed by replaying each pilot's keystroke
 * log rather than trusting the WPM their client was displaying.
 */
export interface ResultRow {
  id: string;
  name: string;
  isBot: boolean;
  placement: number;
  /** What the client claimed via flow 1, kept only to show the two side by side. */
  clientWpm: number;
  /** What the server derived from flow 3. This is the one that would be stored. */
  serverWpm: number;
  completionMs: number | null;
  accuracy: number;
  /** How far they actually got. Only meaningful for a DNF, where it breaks ties. */
  progress: number;
  hullBreaches: number;
  dnf: boolean;
}

export interface ResultsMsg {
  rows: ResultRow[];
}

// ---------------------------------------------------------------------------
// Dev tuning (bidirectional: the panel edits server-side knobs too)
// ---------------------------------------------------------------------------

export interface TuneMsg {
  config?: Partial<RaceConfig>;
  net?: Partial<NetConfig>;
  bots?: Partial<BotConfig>;
}

export const EVENTS = {
  join: 'join',
  pilotState: 'pilot:state',
  pilotEvent: 'pilot:event',
  pilotKeys: 'pilot:keys',
  tune: 'tune',
  restart: 'restart',

  welcome: 'welcome',
  lobby: 'lobby',
  start: 'start',
  snapshot: 'snapshot',
  relayEvent: 'relay:event',
  results: 'results',
} as const;
