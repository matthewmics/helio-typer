import { Avatar } from "@/components/ui/avatar";
import { Card, CardLink, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { LEADERBOARD } from "@/lib/data/leaderboard";
import { PILOT } from "@/lib/data/profile";
import type { Viewer } from "@/lib/viewer";

const Wpm = ({ value }: { value: number }) => (
  <span className="shrink-0 font-display text-sm font-bold">
    {value}{" "}
    <span className="text-xs font-semibold text-ink-dim">WPM</span>
  </span>
);

/**
 * The top of the board, and where you sit on it. Every race counts toward
 * the rankings, so this is the home page's answer to "how am I doing".
 */
export function TopPilots({ viewer }: { viewer: Viewer }) {
  return (
    <Card>
      <CardTitle>Top pilots</CardTitle>

      <ol>
        {LEADERBOARD.slice(0, 3).map((pilot, i) => (
          <li
            key={pilot.name}
            className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0"
          >
            <span
              className={cn(
                "w-5 shrink-0 font-display text-sm font-bold",
                i === 0 ? "text-gold" : "text-ink-dim",
              )}
            >
              {i + 1}
            </span>
            <Avatar name={pilot.name} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm">{pilot.name}</span>
            <Wpm value={pilot.wpm} />
          </li>
        ))}
      </ol>

      {viewer === "user" ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/7 px-3 py-2.5">
          <span className="shrink-0 font-display text-sm font-bold text-accent">
            #{PILOT.globalRank}
          </span>
          <Avatar name={PILOT.handle} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm">
            {PILOT.handle} <span className="text-xs text-accent">(you)</span>
          </span>
          <Wpm value={PILOT.wpm} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-dim">
          Guests race unranked. Sign in to get on the board.
        </p>
      )}

      <CardLink href="/rankings">Full rankings →</CardLink>
    </Card>
  );
}
