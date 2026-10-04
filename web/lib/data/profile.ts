import { levelProgress } from "@/lib/levels";
import type { Achievement, RaceResult } from "@/lib/types";

/** Total experience. The level follows from it, so the two can never disagree. */
const XP = 3154;

/** The signed-in pilot. Static until there is a backend to read it from. */
export const PILOT = {
  handle: "jaydee",
  xp: XP,
  level: levelProgress(XP).level,
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

/**
 * There is one way to race and every race is ranked, so a result is a place
 * among six pilots and nothing else. A breach stalls a ship rather than ending
 * its run, so every one of these finished.
 */
export const RACE_HISTORY: RaceResult[] = [
  { place: "1st", detail: "6 pilots · 4h ago", score: "94 wpm" },
  { place: "3rd", detail: "6 pilots · 5h ago", score: "81 wpm" },
  { place: "5th", detail: "6 pilots · stalled twice · 6h ago", score: "62 wpm" },
  { place: "2nd", detail: "6 pilots · yesterday", score: "88 wpm" },
  { place: "1st", detail: "6 pilots · yesterday", score: "91 wpm" },
];

export const RECENT_RACES = RACE_HISTORY.slice(0, 4);

export const ACHIEVEMENTS: Achievement[] = [
  {
    name: "Clean ascent",
    requirement: "Win without losing a hull segment",
    glyph: "◎",
    unlocked: true,
  },
  {
    name: "Century club",
    requirement: "Break 100 WPM in a race",
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
    requirement: "Win 5 races in a row",
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
