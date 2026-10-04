import { RocketMark } from "@/components/rocket-mark";
import { HeroActions } from "@/components/home/hero-actions";

export function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line-hi bg-[radial-gradient(circle_at_82%_18%,rgba(79,216,255,0.18)_0%,transparent_48%),linear-gradient(150deg,var(--color-panel-hi),var(--color-panel))] p-8">
      <RocketMark
        detail="full"
        className="absolute -bottom-3.5 right-6 w-29.5 animate-float opacity-50"
      />

      <p className="mb-2 font-display text-2xs font-semibold uppercase tracking-[0.2em] text-accent">
        Season 1 · Week 3
      </p>
      <h2 className="mb-2 max-w-[15ch] font-display text-3xl font-bold">
        Accuracy is altitude.
      </h2>
      <p className="mb-6 max-w-[44ch] text-base leading-relaxed text-ink-dim">
        Every correct keystroke builds thrust. Thrust bleeds away the moment you
        hesitate. One mistake drops you to zero and cracks the hull.
      </p>

      <HeroActions />
    </section>
  );
}
