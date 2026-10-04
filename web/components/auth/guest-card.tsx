import { SignInButton } from "@/components/auth/sign-in-button";
import { Card, CardTitle } from "@/components/ui/card";

const KEPT = [
  "Race history",
  "WPM over time",
  "A place on the leaderboard",
  "Achievements",
];

/** Stands in for the stats a guest does not have, and says how to get them. */
export function GuestCard() {
  return (
    <Card>
      <CardTitle>Flying as a guest</CardTitle>
      <p className="mb-4 max-w-[52ch] text-sm leading-relaxed text-ink-dim">
        Race as much as you like. Nothing a guest flies is saved, so sign in to
        start keeping a record.
      </p>
      <ul className="mb-5 grid gap-2 sm:grid-cols-2">
        {KEPT.map((item) => (
          <li key={item} className="flex items-center gap-2.5 text-sm">
            <span className="text-2xs text-accent" aria-hidden>
              ▲
            </span>
            {item}
          </li>
        ))}
      </ul>
      <SignInButton />
    </Card>
  );
}
