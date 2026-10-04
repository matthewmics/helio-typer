import { GuestCard } from "@/components/auth/guest-card";
import { DailyContract } from "@/components/home/daily-contract";
import { Hero } from "@/components/home/hero";
import { ModeList } from "@/components/home/mode-list";
import { RaceHistoryList } from "@/components/race-history-list";
import { Card, CardStack, CardTitle } from "@/components/ui/card";
import { StatTile, StatTileGrid } from "@/components/ui/stat-tile";
import { PILOT, RECENT_RACES } from "@/lib/data/profile";
import { getViewer } from "@/lib/viewer";

export default async function HomePage() {
  const viewer = await getViewer();

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
      <CardStack>
        <Hero />

        {viewer === "user" ? (
          <>
            <StatTileGrid>
              <StatTile value={PILOT.wpm} label="Your WPM" />
              <StatTile value={PILOT.accuracy} label="Accuracy" tone="success" />
              <StatTile value={`#${PILOT.globalRank}`} label="Global rank" />
              <StatTile value={PILOT.wins} label="Races won" />
            </StatTileGrid>

            <DailyContract />
          </>
        ) : (
          <GuestCard />
        )}
      </CardStack>

      <CardStack>
        <Card>
          <CardTitle>Game modes</CardTitle>
          <ModeList />
        </Card>

        {viewer === "user" && (
          <Card>
            <CardTitle>Recent races</CardTitle>
            <RaceHistoryList races={RECENT_RACES} />
          </Card>
        )}
      </CardStack>
    </div>
  );
}
