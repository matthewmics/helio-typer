import type { Metadata } from "next";
import { HangarBrowser } from "@/components/hangar/hangar-browser";
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
    </>
  );
}
