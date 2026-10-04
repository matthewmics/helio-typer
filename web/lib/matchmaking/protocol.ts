/**
 * The client half of the matchmaking wire protocol.
 *
 * Hand-mirrored from `api/src/matchmaking/matchmaking.protocol.ts`. That is a
 * duplicate and it is the second one in this repo, after `Race`. Both want the
 * same fix: a shared workspace package that `web/` and `api/` compile against,
 * so a field renamed on one side breaks the build on the other instead of
 * failing silently at runtime. Until that exists, changes here have to be made
 * in both files.
 */

export type PilotStatus = "pending" | "accepted" | "declined" | "timeout";

/** No bot flag on purpose: the server does not send one. */
export type MatchPilot = {
  id: string;
  name: string;
  status: PilotStatus;
};

export type GuestIdentityMsg = {
  guestId: string;
  name: string;
  resumeToken: string;
};

export type QueueStatusMsg = {
  state: "idle" | "queued" | "ready_check";
  position: number | null;
  waiting: number;
  queuedAt: number | null;
  now: number;
};

export type MatchFoundMsg = {
  matchId: string;
  /** Absolute server time, not a duration, so a late delivery still counts down truthfully. */
  deadline: number;
  now: number;
  total: number;
  accepted: number;
  pilots: MatchPilot[];
};

export type MatchProgressMsg = {
  matchId: string;
  accepted: number;
  total: number;
  pilots: MatchPilot[];
};

export type MatchConfirmedMsg = {
  matchId: string;
  seed: number;
  pilots: MatchPilot[];
};

export type MatchFailedMsg = {
  matchId: string;
  reason: "declined" | "timeout";
  requeued: boolean;
};

export const MM_EVENTS = {
  queueJoin: "queue:join",
  queueLeave: "queue:leave",
  readyAccept: "ready:accept",
  readyDecline: "ready:decline",

  guestIdentity: "guest:identity",
  queueStatus: "queue:status",
  matchFound: "match:found",
  matchProgress: "match:progress",
  matchConfirmed: "match:confirmed",
  matchFailed: "match:failed",
} as const;
