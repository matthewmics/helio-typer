"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ResultRow } from "@/lib/race/use-race-connection";

/**
 * Final standings, shown once every pilot in the lobby is done.
 *
 * Sits over the game's own end screen rather than replacing it: that one appears
 * the moment *you* cross, which is usually well before the field has. Crossing
 * the line and learning where you placed are two different moments and the run
 * reads better if they stay that way.
 */
export function RaceResults({ rows, youName }: { rows: ResultRow[]; youName: string }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Final standings"
      className="fixed inset-0 z-50 grid place-items-center bg-void/85 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-125 rounded-3xl border border-line-hi bg-panel p-7 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <p className="mb-5 text-center font-display text-2xs font-semibold uppercase tracking-[0.2em] text-accent">
          Final standings
        </p>

        <ol className="mb-6 flex flex-col gap-1.5">
          {rows.map((row) => {
            const you = row.name === youName;
            return (
              <li
                key={row.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3.5 py-2.5",
                  you ? "border-accent bg-accent/[0.07]" : "border-line bg-panel-hi",
                )}
              >
                <span className="w-5 shrink-0 text-center font-display text-base font-bold tabular-nums text-ink-dim">
                  {row.placement}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-sm">{row.name}</span>
                <span className="shrink-0 text-2xs tabular-nums text-ink-dim">
                  {row.dnf ? "did not finish" : `${row.wpm} wpm`}
                </span>
                <span className="w-14 shrink-0 text-right text-2xs tabular-nums text-ink-dim">
                  {row.completionMs === null ? "" : `${(row.completionMs / 1000).toFixed(1)}s`}
                </span>
              </li>
            );
          })}
        </ol>

        <Link href="/" className={buttonStyles({ block: true })}>
          Back to hub
        </Link>
      </div>
    </div>
  );
}
