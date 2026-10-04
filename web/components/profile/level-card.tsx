import { Card, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { levelProgress } from "@/lib/levels";

/**
 * Where you are on the way to the next level, Pokemon style: the XP bar, how
 * much is in it, and how much is left before it fills.
 */
export function LevelCard({ xp }: { xp: number }) {
  const progress = levelProgress(xp);
  const next = progress.level + 1;
  const left = progress.span - progress.into;

  return (
    <Card>
      <CardTitle>Level</CardTitle>

      <div className="mb-3 flex items-end justify-between font-display">
        <b className="text-3xl leading-none">{progress.level}</b>
        <span className="text-sm text-ink-dim">Lv {next}</span>
      </div>

      <Meter
        value={progress.fraction}
        aria-label="Experience"
        aria-valuetext={`${progress.into} of ${progress.span} XP to level ${next}`}
        className="h-2.5"
      />

      <div className="mt-2 flex justify-between text-xs text-ink-dim">
        <span>
          <b className="font-display text-ink">{progress.into.toLocaleString()}</b> /{" "}
          {progress.span.toLocaleString()} XP
        </span>
        <span>
          <b className="font-display text-accent">{left.toLocaleString()}</b> XP to go
        </span>
      </div>

      <p className="mt-3 border-t border-line pt-3 text-xs text-ink-dim">
        {xp.toLocaleString()} XP earned in all
      </p>
    </Card>
  );
}
