export type Rarity = "common" | "rare" | "epic" | "legend";

/**
 * A ship is pure cosmetics.
 *
 * No stats, no perks, nothing that can touch a race outcome. Every pilot flies
 * identical physics whatever is in their hangar, which is what keeps completion
 * time and WPM comparable between two runs. See the decision in
 * .claude/notes/ideas.md; this type is deliberately shaped so a stat cannot be
 * added back without the change being obvious in review.
 */
export type Ship = {
  id: string;
  name: string;
  rarity: Rarity;
  /** Fill colors for the ship mark: body, near fin, far fin. */
  hull: string;
  fin: string;
  finShadow: string;
  owned: boolean;
  /** Unlock price, only meaningful while `owned` is false. */
  cost?: number;
  /** One line on how it looks. Never on how it flies. */
  flavor: string;
};

export type GameMode = {
  id: string;
  name: string;
  blurb: string;
  glyph: string;
  tag?: { label: string; tone: "success" | "special" | "gold" };
};

export type RankedPilot = {
  name: string;
  wpm: number;
  accuracy: string;
  races: number;
  /** Places gained (+) or lost (-) since the last board. */
  delta: number;
};

export type LobbyPilot = {
  name: string;
  detail: string;
  ready: boolean;
  isYou?: boolean;
};

export type RaceResult = {
  /** Finishing place, or "DNF" when the run ended early. */
  place: string;
  detail: string;
  score: string;
};

export type Achievement = {
  name: string;
  requirement: string;
  glyph: string;
  unlocked: boolean;
};
