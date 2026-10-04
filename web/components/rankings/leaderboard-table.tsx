import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import type { RankedPilot } from "@/lib/types";

const HEADINGS = ["#", "Pilot", "Avg WPM", "Accuracy", "Races", "Trend"];

/** Cells carry their own borders so rows can be spaced apart and rounded. */
const CELL =
  "border-y border-line px-3 py-3.5 first:w-13 first:rounded-l-lg first:border-l first:font-display first:font-bold first:text-ink-dim last:rounded-r-lg last:border-r";

function Trend({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-xs text-ink-faint">·</span>;

  return (
    <span
      className={cn("text-xs", delta > 0 ? "text-success" : "text-danger")}
    >
      {delta > 0 ? `▲ ${delta}` : `▼ ${-delta}`}
    </span>
  );
}

export type LeaderboardTableProps = {
  pilots: RankedPilot[];
  /** The signed-in pilot, pinned below the top of the board. Guests have no row. */
  you?: RankedPilot & { rank: number };
};

export function LeaderboardTable({ pilots, you }: LeaderboardTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-160 border-separate border-spacing-y-2">
        <thead>
          <tr>
            {HEADINGS.map((heading) => (
              <th
                key={heading}
                scope="col"
                className="px-3 pb-2 text-left font-display text-2xs font-semibold uppercase tracking-[0.13em] text-ink-faint"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pilots.map((pilot, i) => (
            <tr
              key={pilot.name}
              className="bg-panel text-sm transition-colors duration-150 hover:bg-panel-hi"
            >
              <td className={CELL}>{i + 1}</td>
              <td className={CELL}>
                <div className="flex items-center gap-2.5">
                  <Avatar name={pilot.name} size="sm" />
                  {pilot.name}
                </div>
              </td>
              <td className={cn(CELL, "font-display font-bold")}>
                {pilot.wpm}
              </td>
              <td className={CELL}>{pilot.accuracy}</td>
              <td className={CELL}>{pilot.races}</td>
              <td className={CELL}>
                <Trend delta={pilot.delta} />
              </td>
            </tr>
          ))}

          {you && (
            <>
              <tr>
                <td
                  colSpan={HEADINGS.length}
                  className="py-1.5 text-center tracking-[0.3em] text-ink-faint"
                >
                  · · ·
                </td>
              </tr>

              <tr className="bg-accent/[0.07] text-sm [&_td]:border-accent">
                <td className={CELL}>{you.rank}</td>
                <td className={CELL}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={you.name} size="sm" />
                    {you.name}
                    <span className="text-2xs text-accent">(you)</span>
                  </div>
                </td>
                <td className={cn(CELL, "font-display font-bold")}>{you.wpm}</td>
                <td className={CELL}>{you.accuracy}</td>
                <td className={CELL}>{you.races}</td>
                <td className={CELL}>
                  <Trend delta={you.delta} />
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
