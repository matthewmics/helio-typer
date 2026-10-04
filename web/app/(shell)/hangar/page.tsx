import type { Metadata } from "next";
import { HangarBrowser } from "@/components/hangar/hangar-browser";
import { DesignNote } from "@/components/ui/design-note";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Hangar · HelioTyper" };

export default function HangarPage() {
  return (
    <>
      <PageHeader
        eyebrow="Loadout"
        title="Hangar"
        subtitle="Every ship flies the same. Pick the one you want to be seen in."
      />

      <HangarBrowser />

      <DesignNote title="Settled: cosmetic only.">
        Ships carried stat perks here until this was decided the other way. A
        purchasable stat is a second variable inside completion time and WPM,
        which are the two numbers the whole game exists to measure, and every fix
        for that costs more than the perks were worth. What a ship still has to
        earn is wanting to be seen in it.
      </DesignNote>
    </>
  );
}
