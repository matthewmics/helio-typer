"use client";

import { DEFAULT_CONFIG } from "@heliotyper/engine";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import type { RaceNetClient } from "@/game/net";
import type { RunResult } from "@/game/scenes/RaceScene";
import { cn } from "@/lib/cn";
import type { ResultRow } from "@/lib/race/use-race-connection";

type Standing = {
  id: string;
  name: string;
  you: boolean;
  place: number;
  state: "finished" | "racing" | "dnf";
  timeMs: number | null;
  wpm: number | null;
  /** Live while they fly, settled once they cross. Null when nobody knows. */
  mistakes: number | null;
  progress: number;
};

/** How often the live standings refresh while the field is still flying. */
const REFRESH_MS = 250;

/**
 * Place, pilot, mistakes, WPM, time: shared by the heading row and every
 * pilot's row. Tighter on a phone, where the pilot's name needs every pixel.
 */
const COLUMNS =
  "grid grid-cols-[1.25rem_minmax(0,1fr)_2.75rem_2.25rem_3.25rem] items-center gap-1.5 sm:grid-cols-[1.5rem_minmax(0,1fr)_4rem_3rem_3.5rem] sm:gap-3";

/**
 * Who is where right now: banked finishes by their official time, then
 * everyone still flying by how far they have got. A pilot crossing later can
 * only ever slot in behind everyone who crossed before them, so the places at
 * the top settle the moment they are banked and only the back keeps moving.
 */
function liveStandings(net: RaceNetClient, you: RunResult | null): Standing[] {
  const rows = net.pilots.map((p): Standing => {
    const base = { id: p.id, name: p.name, you: p.isYou, place: 0 };
    const banked = net.finishes.get(p.id);
    if (banked) {
      return {
        ...base,
        state: "finished",
        timeMs: banked.completionMs,
        wpm: banked.wpm,
        mistakes: banked.mistakes,
        progress: 1,
      };
    }
    // Your own finish is a round trip from being banked. Until it is, your own
    // clock and count stand in for the server's.
    if (p.isYou && you?.finished) {
      return { ...base, state: "finished", timeMs: you.timeMs, wpm: you.wpm, mistakes: you.mistakes, progress: 1 };
    }
    if (p.isYou) {
      return { ...base, state: "racing", timeMs: null, wpm: null, mistakes: you?.mistakes ?? null, progress: you?.progress ?? 0 };
    }
    return {
      ...base,
      state: "racing",
      timeMs: null,
      wpm: null,
      mistakes: net.field.latest(p.id)?.mistakes ?? null,
      progress: net.field.view(p.id, DEFAULT_CONFIG.maxHull)?.progress ?? 0,
    };
  });

  rows.sort((a, b) => {
    const aDone = a.state === "finished";
    const bDone = b.state === "finished";
    if (aDone !== bDone) return aDone ? -1 : 1;
    if (aDone) return (a.timeMs ?? 0) - (b.timeMs ?? 0);
    return b.progress - a.progress;
  });
  rows.forEach((row, i) => (row.place = i + 1));
  return rows;
}

/** The server's closing word, which replaces the live list once it arrives. */
function finalStandings(rows: ResultRow[], youId: string): Standing[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    you: row.id === youId,
    place: row.placement,
    state: row.dnf ? "dnf" : "finished",
    timeMs: row.completionMs,
    wpm: row.wpm,
    mistakes: row.mistakes,
    progress: row.progress,
  }));
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

function seconds(ms: number | null): string {
  return ms === null ? "" : `${(ms / 1000).toFixed(1)}s`;
}

/** Gold, silver and bronze for the podium, plain ink for everyone else. */
function placeTone(place: number): string {
  return place === 1 ? "text-gold" : place === 2 ? "text-silver" : place === 3 ? "text-bronze" : "text-ink";
}

export type FinishModalProps = {
  /** Your run. Null when the race closed before you crossed. */
  result: RunResult | null;
  /** The race, for the live standings. Absent for a solo run. */
  net?: RaceNetClient;
  /** Final standings, once the server has closed the race. */
  final: ResultRow[] | null;
  /** Solo only: run it again. */
  onFlyAgain?: () => void;
};

/**
 * What you get for crossing the heliopause: where you placed and how you flew,
 * over the standings of the whole field. The standings stay live while anyone
 * is still flying, then settle into the server's final word.
 */
export function FinishModal({ result, net, final, onFlyAgain }: FinishModalProps) {
  const [live, setLive] = useState<Standing[]>(() => (net ? liveStandings(net, result) : []));

  // Polled rather than pushed: the standings come from the snapshot buffer and
  // the banked finishes, which change many times a second, and a few refreshes
  // a second is all a list of names needs.
  useEffect(() => {
    if (!net || final) return;
    const id = setInterval(() => setLive(liveStandings(net, result)), REFRESH_MS);
    return () => clearInterval(id);
  }, [net, result, final]);

  const standings = net && final ? finalStandings(final, net.youId) : live;
  const mine = standings.find((row) => row.you) ?? null;
  const crossed = result?.finished ?? mine?.state === "finished";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="finish-title"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-void/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-3xl border border-line-hi bg-panel p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] sm:p-7">
        <p
          id="finish-title"
          className="text-center font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent"
        >
          {crossed ? "You crossed the heliopause" : "Race over"}
        </p>

        <div className="mb-6 mt-3 text-center">
          {!net ? (
            <>
              <b className="block font-display text-4xl font-bold">{seconds(result?.timeMs ?? 0)}</b>
              <span className="mt-1 block text-sm text-ink-dim">Solo run</span>
            </>
          ) : crossed && mine ? (
            <>
              <b className={cn("block font-display text-4xl font-bold", placeTone(mine.place))}>
                {ordinal(mine.place)}
              </b>
              <span className="mt-1 block text-sm text-ink-dim">
                of {standings.length} pilots
              </span>
            </>
          ) : (
            <>
              <b className="block font-display text-4xl font-bold text-danger">DNF</b>
              <span className="mt-1 block text-sm text-ink-dim">
                The race closed before you crossed.
              </span>
            </>
          )}
        </div>

        {result && (
          <dl className="mb-6 grid grid-cols-4 gap-2">
            {[
              ["WPM", String(result.wpm)],
              ["Accuracy", `${result.accuracy}%`],
              ["Time", seconds(result.timeMs)],
              ["Mistakes", String(result.mistakes)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-panel-hi px-2 py-3 text-center">
                <dd className="font-display text-lg font-bold tabular-nums">{value}</dd>
                <dt className="mt-0.5 text-2xs uppercase tracking-widest text-ink-dim">{label}</dt>
              </div>
            ))}
          </dl>
        )}

        {net && (
          <>
            <p className="mb-3 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-widest text-ink-dim">
              {!final && (
                <span className="size-2 animate-pulse rounded-full bg-success shadow-[0_0_7px_var(--color-success)]" />
              )}
              {final ? "Final standings" : "Live standings"}
            </p>

            <div
              aria-hidden
              className={cn(
                COLUMNS,
                "mb-1.5 px-3 font-display text-2xs font-semibold uppercase tracking-wider text-ink-faint sm:px-3.5 sm:tracking-widest",
              )}
            >
              <span className="text-center">#</span>
              <span>Pilot</span>
              {/* Wider than its column on a phone, so it borrows the gaps either side. */}
              <span className="-mx-2 text-center sm:mx-0">Mistakes</span>
              <span className="text-right">WPM</span>
              <span className="text-right">Time</span>
            </div>

            <ol className="mb-6 flex flex-col gap-1.5">
              {standings.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    COLUMNS,
                    "rounded-xl border px-3 py-2.5 sm:px-3.5",
                    row.you ? "border-accent bg-accent/7" : "border-line bg-panel-hi",
                  )}
                >
                  <span
                    className={cn(
                      "text-center font-display text-base font-bold tabular-nums",
                      row.state === "racing" ? "text-ink-dim" : placeTone(row.place),
                    )}
                  >
                    {row.place}
                  </span>
                  <span className="min-w-0 truncate font-display text-sm">
                    {row.name}
                    {/* On a phone the highlighted row says it, and the name needs the room. */}
                    {row.you && <span className="ml-1.5 text-xs text-accent max-sm:sr-only">(you)</span>}
                  </span>
                  <span
                    className={cn(
                      "text-center font-display text-sm tabular-nums",
                      row.mistakes ? "text-danger" : "text-ink-dim",
                    )}
                  >
                    {row.mistakes ?? ""}
                  </span>

                  {row.state === "racing" ? (
                    <span className="col-span-2 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-well">
                        <span
                          className="block h-full rounded-full bg-accent transition-[width] duration-300"
                          style={{ width: `${Math.round(row.progress * 100)}%` }}
                        />
                      </span>
                      <span className="w-9 text-right text-xs tabular-nums text-ink-dim">
                        {Math.round(row.progress * 100)}%
                      </span>
                    </span>
                  ) : row.state === "dnf" ? (
                    <span className="col-span-2 text-right text-xs text-ink-dim">Did not finish</span>
                  ) : (
                    <>
                      <span className="text-right text-xs tabular-nums text-ink-dim">{row.wpm}</span>
                      <b className="text-right font-display text-sm tabular-nums">{seconds(row.timeMs)}</b>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}

        <div className="flex flex-wrap gap-3">
          {onFlyAgain && (
            <Button onClick={onFlyAgain} className="flex-1 justify-center">
              Fly again
            </Button>
          )}
          <Link href="/" className={buttonStyles({ variant: onFlyAgain ? "ghost" : "primary", className: "flex-1 justify-center" })}>
            Back to hub
          </Link>
        </div>
      </div>
    </div>
  );
}
