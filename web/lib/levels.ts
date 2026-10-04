/**
 * Experience and levels, Pokemon style: XP piles up from races, and each level
 * takes more of it than the one before.
 *
 * The total XP to reach a level is that level cubed, the curve Pokemon calls
 * "medium fast". Early levels come within a race or two, and later ones are
 * something to work toward, which is the whole job of a level bar.
 */
export function xpToReach(level: number): number {
  return level <= 1 ? 0 : level ** 3;
}

export type LevelProgress = {
  level: number;
  /** XP earned since this level was reached. */
  into: number;
  /** XP this level takes from start to finish. */
  span: number;
  /** How far through the level, 0 to 1. */
  fraction: number;
};

/** Where a pilot with this much XP stands on the curve. */
export function levelProgress(totalXp: number): LevelProgress {
  let level = 1;
  while (xpToReach(level + 1) <= totalXp) level++;
  const start = xpToReach(level);
  const span = xpToReach(level + 1) - start;
  const into = totalXp - start;
  return { level, into, span, fraction: into / span };
}
