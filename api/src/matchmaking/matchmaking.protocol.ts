/**
 * The matchmaking wire protocol.
 *
 * Separate from the in-race protocol in the multiplayer prototype on purpose:
 * this covers everything up to the starting line, and none of it is on a hot
 * path. A guest sends maybe four of these messages in a session, so clarity beats
 * compactness everywhere in this file.
 */

export type PilotStatus = 'pending' | 'accepted' | 'declined' | 'timeout';

/**
 * A pilot as the client sees them.
 *
 * Deliberately carries no bot flag. The server knows perfectly well which pilots
 * it is simulating, and says so in its own logs, but a lobby that announces
 * "4 of these are bots" reads as a consolation prize rather than as a race. The
 * callsigns come from the same generator either way, so there is nothing in this
 * payload to tell them apart.
 */
export interface MatchPilot {
  id: string;
  name: string;
  status: PilotStatus;
}

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------

/** Sent once on connect. The guest's callsign for this session. */
export interface GuestIdentityMsg {
  guestId: string;
  name: string;
  /** Echo back on the next connection to keep the same callsign across a refresh. */
  resumeToken: string;
}

export interface QueueStatusMsg {
  state: 'idle' | 'queued' | 'ready_check';
  /** 1-based place in line, or null when not queued. */
  position: number | null;
  /** Everyone waiting across the whole cluster, not just this instance. */
  waiting: number;
  /** Server clock when this guest entered the queue, or null. */
  queuedAt: number | null;
  /** Server clock now, so the client can render a wait timer without clock skew. */
  now: number;
}

/**
 * A match has been formed and every pilot in it has to accept.
 *
 * Carries `deadline` as an absolute server timestamp rather than a remaining
 * duration, so a client that receives it late shows the true time left instead of
 * a countdown that started too generous.
 */
export interface MatchFoundMsg {
  matchId: string;
  deadline: number;
  now: number;
  total: number;
  accepted: number;
  pilots: MatchPilot[];
}

/** Live "4 of 6 accepted" updates while the ready check is open. */
export interface MatchProgressMsg {
  matchId: string;
  accepted: number;
  total: number;
  pilots: MatchPilot[];
}

/** Everyone accepted. This is the handoff to the race itself. */
export interface MatchConfirmedMsg {
  matchId: string;
  /** Drives the shared sentence sequence, so every pilot types the same list. */
  seed: number;
  pilots: MatchPilot[];
}

/**
 * The ready check failed. `requeued` says whether this particular guest was put
 * back in line, which is true if they accepted and false if they are the reason
 * it failed.
 */
export interface MatchFailedMsg {
  matchId: string;
  reason: 'declined' | 'timeout';
  requeued: boolean;
}

// ---------------------------------------------------------------------------
// Client -> server
// ---------------------------------------------------------------------------

export interface ReadyDecisionMsg {
  matchId: string;
}

export const MM_EVENTS = {
  // client -> server
  queueJoin: 'queue:join',
  queueLeave: 'queue:leave',
  readyAccept: 'ready:accept',
  readyDecline: 'ready:decline',

  // server -> client
  guestIdentity: 'guest:identity',
  queueStatus: 'queue:status',
  matchFound: 'match:found',
  matchProgress: 'match:progress',
  matchConfirmed: 'match:confirmed',
  matchFailed: 'match:failed',
} as const;
