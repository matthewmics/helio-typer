import { HeroActions } from "@/components/home/hero-actions";
import { ShipAnimation } from "@/components/ship-animation";
import { DEFAULT_ROCKET } from "@/game/resources";
import type { Viewer } from "@/lib/viewer";

/**
 * The one thing to do here: find a match. There is a single way to race, and
 * every race counts toward the rankings, so the hero carries the whole call to
 * action. The rocket beside it is the race's own sprite, flying at cruise.
 */
export function Hero({ viewer }: { viewer: Viewer }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-line-hi bg-[radial-gradient(circle_at_80%_35%,rgba(79,216,255,0.16)_0%,transparent_50%),linear-gradient(150deg,var(--color-panel-hi),var(--color-panel))] px-6 py-8 sm:px-10 sm:py-10">
      <div className="flex items-center gap-10">
        <div className="min-w-0 flex-1">
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {viewer === "user"
              ? "Season 1 · every race is ranked"
              : "Season 1 · guests race unranked"}
          </p>
          <h1 className="mb-3 max-w-[15ch] font-display text-3xl font-bold md:text-4xl">
            Accuracy is altitude.
          </h1>
          <p className="mb-7 max-w-[46ch] text-base leading-relaxed text-ink-dim">
            Every correct keystroke builds thrust. Thrust bleeds away the moment
            you hesitate. One mistake halves your speed and cracks the hull.
          </p>
          <HeroActions />
        </div>

        <ShipAnimation
          id={DEFAULT_ROCKET}
          speed={70}
          scale={1.5}
          className="hidden shrink-0 animate-float md:block"
        />
      </div>
    </section>
  );
}
