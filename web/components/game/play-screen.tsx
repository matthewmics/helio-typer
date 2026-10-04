"use client";

import { useMemo } from "react";
import { useMatchmaking } from "@/components/matchmaking/matchmaking-provider";
import { useRaceConnection } from "@/lib/race/use-race-connection";
import { RaceGame } from "./race-game";
import { RaceResults } from "./race-results";
import "./race-game.css";

/**
 * Decides which race this page is: the one you were matched into, or a solo run.
 *
 * The engine cannot boot until that is settled. A matched race needs the seed and
 * the lane assignments from the server before it builds anything, because a
 * locally invented seed would have you typing different sentences from everyone
 * you are racing.
 */
export function PlayScreen() {
  const { socket, race, guest } = useMatchmaking();
  const { connection, results } = useRaceConnection(socket ?? null, race?.matchId ?? null);

  // A solo seed is rolled once and kept, so a re-render does not restart the run
  // on a different sentence list.
  const soloSeed = useMemo(() => Math.floor(Math.random() * 1e9), []);

  const joining = race !== null && connection === null;
  const youName = guest?.name ?? "Pilot";

  if (joining) {
    return (
      <div className="race-root">
        <div className="race-status">
          <p>Joining the lobby...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <RaceGame
        seed={connection?.seed ?? soloSeed}
        youName={youName}
        net={connection?.client}
      />
      {results && <RaceResults rows={results} youName={youName} />}
    </>
  );
}
