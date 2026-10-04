import type { Achievement, RaceResult } from "@/lib/types";

/** The signed-in pilot. Static until there is a backend to read it from. */
export const PILOT = {
  handle: "jaydee",
  level: 14,
  wpm: 87,
  accuracy: "96.4%",
  globalRank: 412,
  wins: 34,
  races: 218,
  peakWpm: 103,
  hullBreaches: 12,
  joined: "March 2026",
  shipId: "vanguard",
};

export const RECENT_RACES: RaceResult[] = [
  { place: "1st", detail: "Quick match · 5 pilots", score: "94 wpm" },
  { place: "3rd", detail: "Ranked · 5 pilots", score: "81 wpm" },
  { place: "DNF", detail: "Sudden death · hull breach", score: "62%" },
  { place: "2nd", detail: "Quick match · 4 pilots", score: "88 wpm" },
];

export const RACE_HISTORY: RaceResult[] = [
  { place: "1st", detail: "Quick match · 5 pilots · 4h ago", score: "94 wpm" },
  { place: "3rd", detail: "Ranked · 5 pilots · 5h ago", score: "81 wpm" },
  { place: "DNF", detail: "Sudden death · hull breach at 62%", score: "62%" },
  { place: "2nd", detail: "Quick match · 4 pilots · yesterday", score: "88 wpm" },
  { place: "1st", detail: "Private room · 3 pilots · yesterday", score: "91 wpm" },
];

export const ACHIEVEMENTS: Achievement[] = [
  {
    name: "Clean ascent",
    requirement: "Win without losing a hull segment",
    glyph: "◎",
    unlocked: true,
  },
  {
    name: "Century club",
    requirement: "Break 100 WPM in a ranked race",
    glyph: "▲",
    unlocked: true,
  },
  {
    name: "Full throttle",
    requirement: "Hold max thrust for 15 seconds",
    glyph: "✦",
    unlocked: true,
  },
  {
    name: "Untouchable",
    requirement: "Win 5 sudden death races in a row",
    glyph: "☠",
    unlocked: false,
  },
  {
    name: "Top hundred",
    requirement: "Reach global rank 100",
    glyph: "◈",
    unlocked: false,
  },
];

/** WPM for the last 20 races, oldest first. */
export const WPM_HISTORY = [
  72, 78, 75, 83, 80, 88, 85, 79, 91, 87, 94, 89, 96, 88, 103, 92, 86, 95, 90,
  87,
];

/** Share of hull damage attributable to each key, 0 to 1. */
export const KEY_ERROR_RATES: Record<string, number> = {
  P: 0.9,
  Q: 0.75,
  Z: 0.7,
  X: 0.62,
  B: 0.55,
  Y: 0.5,
  M: 0.42,
  V: 0.38,
  W: 0.3,
  K: 0.28,
};
