import { Card, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    glyph: "▲",
    title: "Type to build thrust",
    body: "Every correct key adds speed, and speed is the only thing that moves you. Stop typing and it bleeds away.",
  },
  {
    glyph: "↯",
    title: "Mistakes cost you",
    body: "A wrong key halves your speed and cracks a hull segment. Lose all five and you stall for a second.",
  },
  {
    glyph: "◎",
    title: "Cross the heliopause",
    body: "First through the edge of the solar system, where the solar wind gives out, wins the race.",
  },
];

/** The rules of a race in three lines, for anyone who has not flown one yet. */
export function HowItWorks() {
  return (
    <Card>
      <CardTitle>How a race works</CardTitle>
      <ol className="grid gap-5 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3.5">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-panel-hi font-display text-lg text-accent"
            >
              {step.glyph}
            </span>
            <div>
              <b className="mb-1 block font-display text-base">
                {i + 1}. {step.title}
              </b>
              <p className="text-sm leading-relaxed text-ink-dim">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 border-t border-line pt-4 text-sm text-ink-dim">
        Six pilots a race, all typing the same passage of philosophy. When
        the queue is quiet, bots fill the empty seats after five seconds, so
        there is always a race to fly.
      </p>
    </Card>
  );
}
