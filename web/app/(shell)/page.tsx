import { GuestCard } from "@/components/auth/guest-card";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { TopPilots } from "@/components/home/top-pilots";
import { RaceHistoryList } from "@/components/race-history-list";
import { Card, CardLink, CardStack, CardTitle } from "@/components/ui/card";
import { StatTile, StatTileGrid } from "@/components/ui/stat-tile";
import { PILOT, RECENT_RACES } from "@/lib/data/profile";
import { getViewer } from "@/lib/viewer";

/**
 * One way to race, and every race is ranked, so the page is built around the
 * single Find match in the hero. A guest gets the rules first; a signed-in pilot
 * gets their numbers first and the rules last.
 */
export default async function HomePage() {
  const viewer = await getViewer();

  if (viewer === "guest") {
    return (
      <CardStack>
        <Hero viewer={viewer} />
        <HowItWorks />
        <div className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
          <GuestCard />
          <TopPilots viewer={viewer} />
        </div>
      </CardStack>
    );
  }

  return (
    <CardStack>
      <Hero viewer={viewer} />

      <StatTileGrid>
        <StatTile value={PILOT.wpm} label="Your WPM" />
        <StatTile value={PILOT.accuracy} label="Accuracy" tone="success" />
        <StatTile value={`#${PILOT.globalRank}`} label="Global rank" />
        <StatTile value={PILOT.wins} label="Races won" />
      </StatTileGrid>

      <div className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardTitle>Recent races</CardTitle>
          <RaceHistoryList races={RECENT_RACES} />
          <CardLink href="/profile">Race history →</CardLink>
        </Card>
        <TopPilots viewer={viewer} />
      </div>

      <HowItWorks />
    </CardStack>
  );
}
