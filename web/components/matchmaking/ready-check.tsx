"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RocketMark } from "@/components/rocket-mark";
import { cn } from "@/lib/cn";
import { useMatchmaking } from "./matchmaking-provider";

/** How long the confirmed roster is held on screen before the race opens. */
const LAUNCH_DELAY_MS = 1600;

/** Ticks while a prompt is on screen. */
function useCountdown(deadline: number | null): number {
  const [left, setLeft] = useState(() =>
    deadline === null ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

  return left;
}

/**
 * The accept-or-decline prompt, and the launch that follows it.
 *
 * Rendered by the provider rather than by a page, so it survives navigation: a
 * match can be found while the pilot is reading the rankings, and a prompt that
 * only existed on the home page would simply never appear.
 *
 * The countdown runs against an absolute deadline rather than a duration ticking
 * down locally. A tab that was backgrounded, or a message that arrived late,
 * then shows the true time left instead of a timer that quietly ran slow.
 *
 * Nothing in here distinguishes a simulated pilot from a human one, because the
 * server does not say which is which. See the note on `MatchPilot`.
 */
export function ReadyCheck() {
  const { phase, match, confirmed, accept, decline, dismiss } = useMatchmaking();
  const router = useRouter();
  const [answered, setAnswered] = useState(false);
  const secondsLeft = useCountdown(match?.deadline ?? null);

  // A new match is a new decision, so the buttons come back.
  useEffect(() => {
    setAnswered(false);
  }, [match?.matchId]);

  // Once everyone is in, the race opens on its own. Asking for one more click
  // after the pilot has already committed is a step with nothing to decide.
  // The short hold is so the full roster is legible rather than a flash.
  useEffect(() => {
    if (phase !== "confirmed") return;
    const id = setTimeout(() => {
      router.push("/play");
      // Clear the prompt as it hands off. The provider now lives in the root
      // layout so the socket survives the jump into the race, which also means
      // this overlay would otherwise sit on top of the game.
      dismiss();
    }, LAUNCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [phase, router, dismiss]);

  if (phase !== "ready_check" && phase !== "confirmed") return null;

  const isConfirmed = phase === "confirmed" && confirmed !== null;
  const pilots = isConfirmed ? confirmed.pilots : (match?.pilots ?? []);
  const accepted = isConfirmed ? pilots.length : (match?.accepted ?? 0);
  const total = isConfirmed ? pilots.length : (match?.total ?? 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isConfirmed ? "Launching" : "Match found"}
      className="fixed inset-0 z-50 grid place-items-center bg-void/80 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-125 rounded-3xl border border-line-hi bg-panel p-7 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <p className="mb-1 text-center font-display text-2xs font-semibold uppercase tracking-[0.2em] text-accent">
          {isConfirmed ? "All pilots ready" : "Match found"}
        </p>

        {!isConfirmed && (
          <p
            className={cn(
              "mb-1 text-center font-display text-5xl font-bold tabular-nums transition-colors",
              secondsLeft <= 5 ? "text-danger" : "text-ink",
            )}
          >
            {secondsLeft}
          </p>
        )}

        <p className="mb-5 text-center text-xs text-ink-dim">
          {isConfirmed ? "Launching..." : `${accepted} of ${total} accepted`}
        </p>

        <ul className="mb-6 grid grid-cols-3 gap-2.5">
          {pilots.map((pilot) => (
            <li
              key={pilot.id}
              className={cn(
                "rounded-xl border px-2 py-3 text-center transition duration-150",
                pilot.status === "accepted"
                  ? "border-success/60 bg-success/[0.08]"
                  : pilot.status === "declined" || pilot.status === "timeout"
                    ? "border-danger/60 bg-danger/[0.08]"
                    : "border-line bg-panel-hi",
              )}
            >
              <RocketMark
                className={cn(
                  "mx-auto mb-1.5 w-6 transition-opacity",
                  pilot.status === "accepted" ? "opacity-100" : "opacity-45",
                )}
              />
              <span className="block truncate font-display text-2xs" title={pilot.name}>
                {pilot.name}
              </span>
              <span className="block text-[10px] uppercase tracking-[0.1em] text-ink-dim">
                {pilot.status === "accepted" ? "ready" : "waiting"}
              </span>
            </li>
          ))}
        </ul>

        {!isConfirmed && (
          <div className="flex gap-2.5">
            <Button
              block
              disabled={answered}
              onClick={() => {
                setAnswered(true);
                accept();
              }}
            >
              {answered ? "Waiting for others" : "Accept"}
            </Button>
            <Button
              variant="ghost"
              block
              disabled={answered}
              onClick={() => {
                setAnswered(true);
                decline();
              }}
            >
              Decline
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
