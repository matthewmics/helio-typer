import type { Ship } from "@/lib/types";

/**
 * The hangar roster: the twelve rockets the game has sprite art for, in
 * assets/rockets. Each is its own silhouette with its own exhaust color, so no
 * two read alike even as cutouts. Every ship is open to every pilot, there is
 * nothing to unlock.
 */
export const SHIPS: Ship[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    exhaust: { label: "Orange", color: "#ff8c2b" },
    flavor:
      "The classic. Cream hull, red nose cap and swept fins, and one big engine.",
  },
  {
    id: "kestrel",
    name: "Kestrel",
    exhaust: { label: "Blue", color: "#38a6ff" },
    flavor:
      "A clean interceptor: long graphite nose, two strapped side boosters and three plumes.",
  },
  {
    id: "marauder",
    name: "Marauder",
    exhaust: { label: "Violet", color: "#e03cff" },
    flavor:
      "Faceted gunmetal hull, a visor slit for a cockpit, raked scythe wings and twin engines.",
  },
  {
    id: "bulwark",
    name: "Bulwark",
    exhaust: { label: "Gold", color: "#ffd21f" },
    flavor:
      "A heavy lander: glass dome, hazard-striped armour, landing legs splayed past the hull and three engines.",
  },
  {
    id: "halcyon",
    name: "Halcyon",
    exhaust: { label: "Green", color: "#22f07a" },
    flavor:
      "A slender jade needle threaded through a gold ring wing, under a long rose canopy.",
  },
  {
    id: "gemini",
    name: "Gemini",
    exhaust: { label: "Crimson", color: "#ff1f3d" },
    flavor:
      "Two indigo hulls flown as one, each with its own engine, and the cockpit slung between them.",
  },
  {
    id: "visitor",
    name: "Visitor",
    exhaust: { label: "Lime", color: "#a8ff1f" },
    flavor:
      "A chrome flying saucer ringed with lime lights, and someone looking out of the dome.",
  },
  {
    id: "sunjammer",
    name: "Sunjammer",
    exhaust: { label: "White", color: "#dfe9ff" },
    flavor:
      "A small white craft under a great diamond of iridescent foil, riding the light out.",
  },
  {
    id: "pioneer",
    name: "Pioneer",
    exhaust: { label: "Indigo", color: "#6a7dff" },
    flavor:
      "A heavy lifter in stages, each wider than the last, under a red escape tower.",
  },
  {
    id: "junker",
    name: "Junker",
    exhaust: { label: "Teal", color: "#18e6b8" },
    flavor:
      "Bolted together from spare parts: lopsided engines, a patched hull and a crane arm.",
  },
  {
    id: "manta",
    name: "Manta",
    exhaust: { label: "Pink", color: "#ff4fb0" },
    flavor:
      "A flying wing with no fins at all, its tips swept down and two horns at the front.",
  },
  {
    id: "prism",
    name: "Prism",
    exhaust: {
      label: "Spectrum",
      color: "#b8a6ff",
      swatch:
        "conic-gradient(#ff4b4b, #fff04a, #5dff7a, #3fe8ff, #5a7dff, #c06bff, #ff4b4b)",
    },
    flavor:
      "A faceted crystal held in gold claws, splitting its exhaust into every colour.",
  },
];

export const DEFAULT_SHIP_ID = "vanguard";

export function getShip(id: string): Ship {
  return SHIPS.find((ship) => ship.id === id) ?? SHIPS[0];
}
