/**
 * Every rocket a pilot can fly, named after its sprite sheet in assets/rockets.
 *
 * Not physics: ships are cosmetic and never touch a race. This lives in the
 * engine because it is the one package both sides import. The server picks the
 * bots' ships from this list and the browser loads and draws them, so the two
 * have to agree on the names, and a second copy on either side would drift.
 */
export const ROCKET_IDS = [
  'vanguard', 'kestrel', 'marauder', 'bulwark', 'halcyon', 'gemini',
  'visitor', 'sunjammer', 'pioneer', 'junker', 'manta', 'prism',
] as const;

export type RocketId = (typeof ROCKET_IDS)[number];

/** What every human flies until the race roster carries their hangar choice. */
export const DEFAULT_ROCKET: RocketId = 'vanguard';
