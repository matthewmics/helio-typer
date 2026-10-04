"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import {
  MM_EVENTS,
  type GuestIdentityMsg,
  type MatchConfirmedMsg,
  type MatchFailedMsg,
  type MatchFoundMsg,
  type MatchPilot,
  type MatchProgressMsg,
  type QueueStatusMsg,
} from "@/lib/matchmaking/protocol";
import { ReadyCheck } from "./ready-check";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://api.heliotyper.local";

/** Where the guest's callsign is kept so a refresh does not rename them. */
const RESUME_KEY = "heliotyper.guest";

/**
 * Where the current race lives across the navigation into /play.
 *
 * sessionStorage rather than a ref: the handoff has to survive a refresh on the
 * race page, and a tab that is not racing should not inherit one.
 */
const RACE_KEY = "heliotyper.race";

export type MatchmakingPhase =
  | "connecting"
  | "offline"
  | "idle"
  | "queued"
  | "ready_check"
  | "confirmed";

/** What /play needs to join the race it was sent to. */
export type RaceHandoff = { matchId: string; seed: number };

export type MatchmakingState = {
  phase: MatchmakingPhase;
  /** The live connection, so the race page can talk on it rather than opening a second one. */
  socket: Socket | null;
  /**
   * The match to race, kept after the ready check closes.
   *
   * Deliberately not cleared by `dismiss`: the prompt goes away precisely
   * because we are navigating into the race, and clearing this there would drop
   * the handoff on the floor a frame before /play asks for it.
   */
  race: RaceHandoff | null;
  guest: { guestId: string; name: string } | null;
  /** Everyone waiting across the cluster, not just this instance. */
  waiting: number;
  position: number | null;
  queuedAt: number | null;
  match: { matchId: string; deadline: number; total: number; accepted: number; pilots: MatchPilot[] } | null;
  confirmed: MatchConfirmedMsg | null;
  /** Set when a ready check fails, cleared on the next queue action. */
  notice: string | null;
  joinQueue: () => void;
  leaveQueue: () => void;
  accept: () => void;
  decline: () => void;
  dismiss: () => void;
};

const Context = createContext<MatchmakingState | null>(null);

export function useMatchmaking(): MatchmakingState {
  const value = useContext(Context);
  if (!value) throw new Error("useMatchmaking must be used inside MatchmakingProvider");
  return value;
}

type Stored = { guestId: string; token: string };

/**
 * How far ahead of this browser the server's clock is running.
 *
 * Every timestamp on the wire is server time. Subtracting this puts it on the
 * local clock, which is the only clock `Date.now()` in a countdown can compare
 * against. Without it a machine whose clock is a minute fast shows a ready check
 * that has already expired.
 */
function skew(serverNow: number): number {
  return serverNow - Date.now();
}

function readStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(RESUME_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    // Private windows and blocked site data both throw here. A guest who cannot
    // be remembered just gets a new callsign, which is not worth failing over.
    return null;
  }
}

/**
 * The race handoff, kept as an external store rather than component state.
 *
 * It lives in sessionStorage, which the server does not have. A lazy `useState`
 * initializer reading it rendered no race on the server and the stored race on
 * the first client render, so every refresh into /play failed hydration. Read
 * through `useSyncExternalStore`, React hydrates against the server's answer
 * (no race) and re-renders with the stored one straight after.
 *
 * Held in memory once read, so a tab whose storage is blocked still races.
 */
let storedRace: RaceHandoff | null | undefined;
const raceListeners = new Set<() => void>();

function readRace(): RaceHandoff | null {
  if (storedRace === undefined) {
    try {
      const raw = window.sessionStorage.getItem(RACE_KEY);
      storedRace = raw ? (JSON.parse(raw) as RaceHandoff) : null;
    } catch {
      storedRace = null;
    }
  }
  return storedRace;
}

/** There is no sessionStorage on the server, so as far as it knows there is never a race. */
function readRaceOnServer(): RaceHandoff | null {
  return null;
}

function writeRace(handoff: RaceHandoff): void {
  storedRace = handoff;
  try {
    window.sessionStorage.setItem(RACE_KEY, JSON.stringify(handoff));
  } catch {
    // A tab that cannot remember its race still races, it just cannot be
    // refreshed back into it.
  }
  for (const listener of raceListeners) listener();
}

function subscribeRace(listener: () => void): () => void {
  raceListeners.add(listener);
  return () => {
    raceListeners.delete(listener);
  };
}

/**
 * Holds the matchmaking socket for the whole shell.
 *
 * One connection, mounted once in the shell layout, because a guest identity is
 * tied to a socket: a per-page connection would rename the pilot on every
 * navigation and drop them out of the queue on the way.
 */
export function MatchmakingProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);

  const [phase, setPhase] = useState<MatchmakingPhase>("connecting");
  const [guest, setGuest] = useState<MatchmakingState["guest"]>(null);
  const [waiting, setWaiting] = useState(0);
  const [position, setPosition] = useState<number | null>(null);
  const [queuedAt, setQueuedAt] = useState<number | null>(null);
  const [match, setMatch] = useState<MatchmakingState["match"]>(null);
  const [confirmed, setConfirmed] = useState<MatchConfirmedMsg | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const race = useSyncExternalStore(subscribeRace, readRace, readRaceOnServer);

  useEffect(() => {
    const stored = readStored();
    const socket = io(API_URL, {
      // The server runs WebSocket only, deliberately: long-polling would need
      // sticky sessions once the api is clustered.
      transports: ["websocket"],
      // Presenting the previous identity is how a refresh keeps its callsign.
      // The server checks the token before honouring it.
      auth: stored ? { guestId: stored.guestId, token: stored.token } : {},
    });
    socketRef.current = socket;
    setSocket(socket);

    socket.on("connect", () => setPhase((p) => (p === "connecting" || p === "offline" ? "idle" : p)));
    socket.on("connect_error", () => setPhase("offline"));
    socket.on("disconnect", () => setPhase("offline"));

    socket.on(MM_EVENTS.guestIdentity, (msg: GuestIdentityMsg) => {
      setGuest({ guestId: msg.guestId, name: msg.name });
      try {
        window.localStorage.setItem(
          RESUME_KEY,
          JSON.stringify({ guestId: msg.guestId, token: msg.resumeToken }),
        );
      } catch {
        // Not being able to remember the guest is survivable, see readStored.
      }
    });

    socket.on(MM_EVENTS.queueStatus, (msg: QueueStatusMsg) => {
      setWaiting(msg.waiting);
      setPosition(msg.position);
      setQueuedAt(msg.queuedAt === null ? null : msg.queuedAt - skew(msg.now));
      // Never downgrade out of a ready check on a queue tick: the status push
      // and a match:found can cross on the wire, and losing the prompt because
      // of that would be indistinguishable from the prompt never arriving.
      setPhase((p) =>
        p === "ready_check" || p === "confirmed" ? p : msg.state === "queued" ? "queued" : "idle",
      );
    });

    socket.on(MM_EVENTS.matchFound, (msg: MatchFoundMsg) => {
      setNotice(null);
      setMatch({
        matchId: msg.matchId,
        deadline: msg.deadline - skew(msg.now),
        total: msg.total,
        accepted: msg.accepted,
        pilots: msg.pilots,
      });
      setPhase("ready_check");
    });

    socket.on(MM_EVENTS.matchProgress, (msg: MatchProgressMsg) => {
      setMatch((m) =>
        m && m.matchId === msg.matchId
          ? { ...m, accepted: msg.accepted, total: msg.total, pilots: msg.pilots }
          : m,
      );
    });

    socket.on(MM_EVENTS.matchConfirmed, (msg: MatchConfirmedMsg) => {
      setConfirmed(msg);
      writeRace({ matchId: msg.matchId, seed: msg.seed });
      setPhase("confirmed");
    });

    socket.on(MM_EVENTS.matchFailed, (msg: MatchFailedMsg) => {
      setMatch(null);
      setNotice(
        msg.reason === "declined"
          ? msg.requeued
            ? "A pilot declined. You are back in the queue."
            : "You declined the match."
          : msg.requeued
            ? "Someone did not answer in time. You are back in the queue."
            : "You did not answer in time and left the queue.",
      );
      setPhase(msg.requeued ? "queued" : "idle");
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
      setSocket(null);
    };
  }, []);

  const joinQueue = useCallback(() => {
    setNotice(null);
    socketRef.current?.emit(MM_EVENTS.queueJoin);
  }, []);

  const leaveQueue = useCallback(() => {
    setNotice(null);
    socketRef.current?.emit(MM_EVENTS.queueLeave);
  }, []);

  const accept = useCallback(() => {
    const id = match?.matchId;
    if (id) socketRef.current?.emit(MM_EVENTS.readyAccept, { matchId: id });
  }, [match?.matchId]);

  const decline = useCallback(() => {
    const id = match?.matchId;
    if (id) socketRef.current?.emit(MM_EVENTS.readyDecline, { matchId: id });
  }, [match?.matchId]);

  const dismiss = useCallback(() => {
    setConfirmed(null);
    setMatch(null);
    setPhase("idle");
  }, []);

  const value = useMemo<MatchmakingState>(
    () => ({
      phase,
      socket,
      race,
      guest,
      waiting,
      position,
      queuedAt,
      match,
      confirmed,
      notice,
      joinQueue,
      leaveQueue,
      accept,
      decline,
      dismiss,
    }),
    [phase, socket, race, guest, waiting, position, queuedAt, match, confirmed, notice, joinQueue, leaveQueue, accept, decline, dismiss],
  );

  return (
    <Context.Provider value={value}>
      {children}
      <ReadyCheck />
    </Context.Provider>
  );
}
