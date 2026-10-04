"use client";

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  RemoteField,
  type PilotEventKind,
  type PilotFinish,
  type PilotStateWire,
  type RaceNetClient,
  type RacePilotInfo,
} from "@/game/net";

/** Mirrors `api/src/race/race.protocol.ts`. See the duplication note in matchmaking/protocol.ts. */
const RACE_EVENTS = {
  join: "race:join",
  pilotState: "pilot:state",
  pilotEvent: "pilot:event",

  welcome: "race:welcome",
  lobby: "race:lobby",
  countdown: "race:countdown",
  finish: "race:finish",
  snapshot: "race:snapshot",
  event: "race:event",
  results: "race:results",
} as const;

type FinishMsg = { id: string; completionMs: number; wpm: number; mistakes: number };

type WelcomeMsg = {
  matchId: string;
  youId: string;
  seed: number;
  pilots: RacePilotInfo[];
  snapshotHz: number;
  startAt: number | null;
  now: number;
  joined: number;
  humans: number;
  finishes: FinishMsg[];
};

type LobbyMsg = { joined: number; humans: number };
type CountdownMsg = { startAt: number; now: number };

export type ResultRow = {
  id: string;
  name: string;
  placement: number;
  wpm: number;
  /** Null for a human who never finished: their count was never banked. */
  mistakes: number | null;
  completionMs: number | null;
  progress: number;
  dnf: boolean;
};

export type RaceConnection = {
  seed: number;
  client: RaceNetClient;
};

/**
 * A server-clock instant, moved onto this browser's clock.
 *
 * The two clocks can disagree by seconds, so the server sends its own "now"
 * with every start and only the gap between the two is trusted. Everyone then
 * counts down the same remaining time, whatever their clock says.
 */
function toLocalClock(at: number, serverNow: number): number {
  return Date.now() + (at - serverNow);
}

/**
 * Join a race and wire the socket to the scene.
 *
 * Returns null until the server has answered with the roster: the scene needs
 * the seed and the lane assignments before it can build anything, and guessing
 * either would mean typing a different passage from everyone else.
 */
export function useRaceConnection(
  socket: Socket | null,
  matchId: string | null,
): { connection: RaceConnection | null; results: ResultRow[] | null } {
  const [connection, setConnection] = useState<RaceConnection | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);

  useEffect(() => {
    if (!socket || !matchId) {
      setConnection(null);
      return;
    }

    let cancelled = false;
    // Handlers registered before the join goes out, so a fast welcome cannot
    // arrive before anything is listening for it.
    const eventHandlers: ((id: string, kind: PilotEventKind) => void)[] = [];

    // The same goes for the start and the finishes, which can even overtake
    // the welcome: another pilot's join, on another instance, can set the start
    // between this join reaching the server and its welcome coming back. They
    // are held here and handed to the client once it exists.
    let client: RaceNetClient | null = null;
    let startAt: number | null = null;
    let joined = 0;
    let humans = 0;
    const finishes = new Map<string, PilotFinish>();

    const onLobby = (msg: LobbyMsg) => {
      joined = Math.max(joined, msg.joined);
      humans = msg.humans;
      if (client) {
        client.joined = joined;
        client.humans = humans;
      }
    };

    const onCountdown = (msg: CountdownMsg) => {
      startAt = toLocalClock(msg.startAt, msg.now);
      if (client) client.startAt = startAt;
    };

    const onFinish = (msg: FinishMsg) => {
      finishes.set(msg.id, { completionMs: msg.completionMs, wpm: msg.wpm, mistakes: msg.mistakes });
    };

    const onWelcome = (msg: WelcomeMsg) => {
      if (cancelled || msg.matchId !== matchId) return;
      const field = new RemoteField(msg.snapshotHz);

      if (startAt === null && msg.startAt !== null) startAt = toLocalClock(msg.startAt, msg.now);
      joined = Math.max(joined, msg.joined);
      humans = msg.humans;
      for (const f of msg.finishes) {
        if (!finishes.has(f.id)) {
          finishes.set(f.id, { completionMs: f.completionMs, wpm: f.wpm, mistakes: f.mistakes });
        }
      }

      client = {
        youId: msg.youId,
        pilots: msg.pilots,
        field,
        startAt,
        joined,
        humans,
        finishes,
        sendState: (state: PilotStateWire) => socket.emit(RACE_EVENTS.pilotState, state),
        sendEvent: (kind: PilotEventKind) =>
          socket.emit(RACE_EVENTS.pilotEvent, { kind, t: Date.now() }),
        onEvent: (handler) => eventHandlers.push(handler),
      };

      socket.on(RACE_EVENTS.snapshot, (snap: { pilots: Record<string, PilotStateWire> }) => {
        field.ingest(snap.pilots);
      });
      socket.on(RACE_EVENTS.event, (msg: { id: string; kind: PilotEventKind }) => {
        for (const handler of eventHandlers) handler(msg.id, msg.kind);
      });

      setConnection({ seed: msg.seed, client });
    };

    const onResults = (msg: { matchId: string; rows: ResultRow[] }) => {
      if (!cancelled && msg.matchId === matchId) setResults(msg.rows);
    };

    socket.on(RACE_EVENTS.welcome, onWelcome);
    socket.on(RACE_EVENTS.lobby, onLobby);
    socket.on(RACE_EVENTS.countdown, onCountdown);
    socket.on(RACE_EVENTS.finish, onFinish);
    socket.on(RACE_EVENTS.results, onResults);
    socket.emit(RACE_EVENTS.join, { matchId });

    return () => {
      cancelled = true;
      socket.off(RACE_EVENTS.welcome, onWelcome);
      socket.off(RACE_EVENTS.lobby, onLobby);
      socket.off(RACE_EVENTS.countdown, onCountdown);
      socket.off(RACE_EVENTS.finish, onFinish);
      socket.off(RACE_EVENTS.results, onResults);
      socket.off(RACE_EVENTS.snapshot);
      socket.off(RACE_EVENTS.event);
    };
  }, [socket, matchId]);

  return { connection, results };
}
