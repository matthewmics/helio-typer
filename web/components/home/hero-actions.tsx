"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMatchmaking } from "@/components/matchmaking/matchmaking-provider";

/** Wall-clock seconds since the pilot joined the queue. */
function useElapsed(since: number | null): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (since === null) {
      setSeconds(0);
      return;
    }
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - since) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [since]);

  return seconds;
}

/**
 * The hero's call to action, wired to real matchmaking.
 *
 * This used to be a link to /lobby and a hardcoded "1,204 pilots online". Both
 * were mockup furniture. The button now actually queues, and the line under it
 * reports the real number of pilots waiting across the cluster, which is usually
 * a much smaller and more honest number.
 */
export function HeroActions() {
  const { phase, guest, waiting, queuedAt, notice, joinQueue, leaveQueue } = useMatchmaking();
  const elapsed = useElapsed(queuedAt);

  const searching = phase === "queued";
  const busy = phase === "connecting";
  const offline = phase === "offline";

  return (
    <>
      {searching ? (
        <Button onClick={leaveQueue} variant="ghost">
          Searching {elapsed}s · Cancel
        </Button>
      ) : (
        <Button onClick={joinQueue} disabled={busy || offline}>
          ▲ {offline ? "Server offline" : busy ? "Connecting" : "Find match"}
        </Button>
      )}

      <p className="mt-5 text-xs text-ink-dim">
        <span
          className={
            offline
              ? "mr-1.5 inline-block size-1.5 rounded-full bg-danger"
              : "mr-1.5 inline-block size-1.5 animate-twinkle rounded-full bg-success shadow-[0_0_7px_var(--color-success)]"
          }
        />
        {offline ? (
          "Cannot reach the matchmaking server"
        ) : searching ? (
          <>
            Matching you with a lobby · {waiting} in queue
          </>
        ) : guest ? (
          <>
            Flying as {guest.name} · {waiting} in queue
          </>
        ) : (
          "Connecting to matchmaking..."
        )}
      </p>

      {notice && <p className="mt-2 text-xs text-danger">{notice}</p>}
    </>
  );
}
