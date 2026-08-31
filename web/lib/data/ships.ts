import type { Ship } from "@/lib/types";

/**
 * The hangar roster.
 *
 * Cosmetics only. These entries used to carry Thrust / Decay resist / Hull
 * numbers and a stat-affecting perk each, which was ruled out: a purchasable
 * stat is a second variable inside the exact number the game exists to measure.
 * What differentiates a ship now is how it looks, so `flavor` describes the
 * paint and nothing else.
 */
export const SHIPS: Ship[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    rarity: "common",
    hull: "#e6e9f7",
    fin: "#4fd8ff",
    finShadow: "#2a9fc2",
    owned: true,
    flavor:
      "Service white with a cyan tail flash. The airframe every other silhouette is a variation on.",
  },
  {
    id: "needle",
    name: "Needle",
    rarity: "rare",
    hull: "#dfe6ff",
    fin: "#a678ff",
    finShadow: "#6f4fc4",
    owned: true,
    flavor:
      "Narrowed nose and swept violet fins. Reads as fast standing still, which is the entire idea.",
  },
  {
    id: "bulwark",
    name: "Bulwark",
    rarity: "rare",
    hull: "#f2e9d8",
    fin: "#4dffb4",
    finShadow: "#22a06b",
    owned: true,
    flavor:
      "Heavy bone-coloured plating with green trim, panel lines picked out like a working freighter.",
  },
  {
    id: "ember",
    name: "Ember",
    rarity: "epic",
    hull: "#ffe3d1",
    fin: "#ff8a4d",
    finShadow: "#c9451f",
    owned: true,
    flavor:
      "Scorched orange down the flanks, as though it has already made the trip once.",
  },
  {
    id: "phantom",
    name: "Phantom",
    rarity: "epic",
    hull: "#d5dcf0",
    fin: "#4fd8ff",
    finShadow: "#1d5f77",
    owned: false,
    cost: 1800,
    flavor:
      "Cold grey that goes nearly matte against deep space, with a thin ice-blue edge light.",
  },
  {
    id: "halcyon",
    name: "Halcyon",
    rarity: "legend",
    hull: "#fff4d6",
    fin: "#ffb84d",
    finShadow: "#c98b1f",
    owned: false,
    cost: 5000,
    flavor:
      "Warm gold leaf over cream. Impractical, conspicuous, and entirely the point.",
  },
];

export const DEFAULT_SHIP_ID = "vanguard";

export function getShip(id: string): Ship {
  return SHIPS.find((ship) => ship.id === id) ?? SHIPS[0];
}
