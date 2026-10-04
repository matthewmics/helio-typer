import type { Metadata } from "next";
import { SignInButton } from "@/components/auth/sign-in-button";
import { LeaderboardTable } from "@/components/rankings/leaderboard-table";
import { Podium } from "@/components/rankings/podium";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { LEADERBOARD, LEADERBOARD_SCOPES } from "@/lib/data/leaderboard";
import { PILOT } from "@/lib/data/profile";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Rankings · HelioTyper" };

export default async function RankingsPage() {
  const viewer = await getViewer();

  return (
    <>
      <PageHeader
        eyebrow="Season 1"
        title="Rankings"
        subtitle="Ranked by average WPM across your last 20 races, with accuracy as the tiebreaker."
      />

      <Tabs options={LEADERBOARD_SCOPES} />

      <Podium pilots={LEADERBOARD} />

      <LeaderboardTable
        pilots={LEADERBOARD}
        you={
          viewer === "user"
            ? {
                name: PILOT.handle,
                wpm: PILOT.wpm,
                accuracy: PILOT.accuracy,
                races: PILOT.races,
                delta: 14,
                rank: PILOT.globalRank,
              }
            : undefined
        }
      />

      {viewer === "guest" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-panel px-5 py-4">
          <p className="text-sm text-ink-dim">
            Guests never appear on the board. Sign in to get ranked.
          </p>
          <SignInButton size="sm" />
        </div>
      )}
    </>
  );
}
