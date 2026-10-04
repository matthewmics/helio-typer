"use client";

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { RemoteField, type PilotEventKind, type PilotStateWire, type RaceNetClient, type RacePilotInfo } from "@/game/net";

/** Mirrors `api/src/race/race.protocol.ts`. See the duplication note in matchmaking/protocol.ts. */
const RACE_EVENTS = {
  join: "race:join",
  pilotState: "pilot:state",
  pilotEvent: "pilot:event",

  welcome: "race:welcome",
  snapshot: "race:snapshot",
  event: "race:event",
  results: "race:results",
} as const;

type WelcomeMsg = {
  matchId: string;
  youId: string;
  seed: number;
  pilots: RacePilotInfo[];
  snapshotHz: number;
};

export type ResultRow = {
  id: string;
  name: string;
  placement: number;
  wpm: number;
  completionMs: number | null;
  dnf: boolean;
};

export type RaceConnection = {
  seed: number;
  client: RaceNetClient;
};

/**
 * Join a race and wire the socket to the scene.
 *
 * Returns null until the server has answered with the roster: the scene needs
 * the seed and the lane assignments before it can build anything, and guessing
 * either would mean typing different sentences from everyone else.
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

    const onWelcome = (msg: WelcomeMsg) => {
      if (cancelled || msg.matchId !== matchId) return;
      const field = new RemoteField(msg.snapshotHz);

      const client: RaceNetClient = {
        youId: msg.youId,
        pilots: msg.pilots,
        field,
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
    socket.on(RACE_EVENTS.results, onResults);
    socket.emit(RACE_EVENTS.join, { matchId });

    return () => {
      cancelled = true;
      socket.off(RACE_EVENTS.welcome, onWelcome);
      socket.off(RACE_EVENTS.results, onResults);
      socket.off(RACE_EVENTS.snapshot);
      socket.off(RACE_EVENTS.event);
    };
  }, [socket, matchId]);

  return { connection, results };
}
