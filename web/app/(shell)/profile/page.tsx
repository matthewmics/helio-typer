import type { Metadata } from "next";
import { GuestCard } from "@/components/auth/guest-card";
import { AchievementList } from "@/components/profile/achievement-list";
import { KeyHeatmap } from "@/components/profile/key-heatmap";
import { Sparkline } from "@/components/profile/sparkline";
import { RaceHistoryList } from "@/components/race-history-list";
import { Card, CardStack, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile, StatTileGrid } from "@/components/ui/stat-tile";
import {
  ACHIEVEMENTS,
  KEY_ERROR_RATES,
  PILOT,
  RACE_HISTORY,
  WPM_HISTORY,
} from "@/lib/data/profile";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Profile · HelioTyper" };

export default async function ProfilePage() {
  if ((await getViewer()) === "guest") {
    return (
      <>
        <PageHeader
          eyebrow="Pilot record"
          title="No record yet"
          subtitle="Guests can race, but nothing a guest flies is saved."
        />
        <div className="max-w-xl">
          <GuestCard />
        </div>
      </>
    );
  }

  const average = Math.round(
    WPM_HISTORY.reduce((sum, value) => sum + value, 0) / WPM_HISTORY.length,
  );

  return (
    <>
      <PageHeader
        eyebrow="Pilot record"
        title={PILOT.handle}
        subtitle={`Level ${PILOT.level} · joined ${PILOT.joined} · ${PILOT.races} races flown`}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <CardStack>
          <Card>
            <CardTitle>WPM over last {WPM_HISTORY.length} races</CardTitle>
            <Sparkline data={WPM_HISTORY} id="wpm-history" />
            <div className="mt-2 flex justify-between text-2xs text-ink-dim">
              <span>{WPM_HISTORY.length} races ago</span>
              <span>
                Best {PILOT.peakWpm} · Avg {average}
              </span>
              <span>Latest</span>
            </div>
          </Card>

          <StatTileGrid>
            <StatTile value={PILOT.peakWpm} label="Peak WPM" />
            <StatTile value={PILOT.accuracy} label="Avg accuracy" />
            <StatTile value={PILOT.wins} label="Wins" />
            <StatTile
              value={PILOT.hullBreaches}
              label="Hull breaches"
              tone="danger"
            />
          </StatTileGrid>

          <Card>
            <CardTitle>Race history</CardTitle>
            <RaceHistoryList races={RACE_HISTORY} />
          </Card>
        </CardStack>

        <CardStack>
          <Card>
            <CardTitle>Achievements</CardTitle>
            <AchievementList items={ACHIEVEMENTS} />
          </Card>

          <Card>
            <CardTitle>Keyboard heatmap</CardTitle>
            <p className="mb-3 text-xs leading-relaxed text-ink-dim">
              Which keys cost you the most hull.
            </p>
            <KeyHeatmap rates={KEY_ERROR_RATES} />
          </Card>
        </CardStack>
      </div>
    </>
  );
}
