import type { Metadata } from "next";
import { RaceGame } from "@/components/game/race-game";

export const metadata: Metadata = {
  title: "HelioTyper: launch",
};

/**
 * The playable race.
 *
 * Deliberately outside the (shell) route group. The game owns the whole viewport
 * and reads every printable keystroke, so the nav, the top bar and the shell's
 * own starfield would all be in the way.
 */
export default function PlayPage() {
  return <RaceGame />;
}
