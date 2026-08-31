/**
 * Typing content, and the seeded sequence every pilot in a race walks.
 *
 * Real 200-260 character paragraphs at the length a race actually uses, all of it
 * typeable on a plain keyboard: no smart quotes, no dashes, no ellipses.
 */
const PARAGRAPHS: readonly string[] = [
  'The heliopause is not a wall you can touch. It is the place where the solar wind finally slows to nothing against the gas between the stars. Voyager 1 crossed it in 2012, and the only way anyone knew was a change in the pitch of the plasma.',
  'Nothing about a rocket launch is gentle. The engines light, the hold downs release, and for a few seconds the whole stack is a controlled explosion pointed at the ground. Everything after that is arithmetic, done quickly and done exactly right.',
  'Jupiter is the largest thing you will pass on the way out. Its bands are storms that have been running for centuries, stacked in belts that never quite line up. The red spot alone is wider than the planet you left this morning.',
  'Saturn reads as a solid object because its rings pass behind it at the top and in front of it at the bottom. Take that away and it flattens into a sticker. Depth is not a detail you add last. It is what makes the shape believable.',
  'Typing well is not about speed. It is about not stopping. A steady rhythm at sixty words a minute will beat a burst of a hundred followed by a scramble to find the key you missed, every time, over any distance that matters.',
  'Pluto is small, cold and mottled, with a pale heart across one face that nobody expected until we got close enough to look. It was named by an eleven year old girl in Oxford who thought the god of the underworld suited a world that dark.',
];

/** Split into sentences, keeping trailing punctuation and dropping the lead space. */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(\s+|$)/g) ?? [text];
  return matches.map((s) => s.trim()).filter(Boolean);
}

/**
 * Typing is endless. Every paragraph is flattened into one pool and sentences
 * keep coming until the ship reaches the heliopause, so there is no "end of text"
 * and therefore no text length to pace the race against. `raceDistance` is the
 * only thing that sets how long a run takes.
 */
export const SENTENCE_POOL: readonly string[] = PARAGRAPHS.flatMap(splitSentences);

/**
 * Mulberry32.
 *
 * Chosen because it is tiny and, more importantly, produces an identical stream
 * from the same seed in every JS runtime. A race is only fair if the browser and
 * the server draw the same sentences in the same order, and `Math.random` gives
 * no such guarantee across engines or even across runs.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How many sentences a race draws up front.
 *
 * Comfortably more than the longest plausible run. Precomputing the whole list
 * rather than drawing lazily is what makes two pilots provably walk the same
 * sequence: there is one array, derived from one seed, and no opportunity for
 * the two sides to fall out of step by calling the generator a different number
 * of times.
 */
export const SEQUENCE_LENGTH = 256;

/** The sentence sequence for a race, identical for every pilot in it. */
export function buildSentenceSequence(seed: number, length = SEQUENCE_LENGTH): string[] {
  const rng = makeRng(seed);
  const out: string[] = [];
  let previous: string | null = null;

  for (let i = 0; i < length; i++) {
    let choice: string;
    if (SENTENCE_POOL.length === 1) {
      choice = SENTENCE_POOL[0];
    } else {
      // Never the same sentence twice in a row: repeating one reads as the game
      // having failed to advance rather than as a draw that happened to repeat.
      do {
        choice = SENTENCE_POOL[Math.floor(rng() * SENTENCE_POOL.length)];
      } while (choice === previous);
    }
    out.push(choice);
    previous = choice;
  }

  return out;
}
