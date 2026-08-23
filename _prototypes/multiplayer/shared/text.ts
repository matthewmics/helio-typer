/**
 * Typing content, plus the seeded picker that keeps every pilot on the same text.
 *
 * Single player could pick sentences at random per client. Multiplayer cannot: if
 * two pilots are typing different text, their WPM is not comparable and the race
 * is not a race. The server issues one seed at match start and every client walks
 * the same deterministic sequence from it.
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

export const SENTENCE_POOL: readonly string[] = PARAGRAPHS.flatMap(splitSentences);

/**
 * Mulberry32. Small, fast, and identical in every JS runtime, which is the only
 * property that matters here: the server's bots and every browser have to walk
 * the same sequence from the same seed or they are not racing on the same text.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The sentence sequence for one race, precomputed from the seed.
 *
 * Precomputing rather than drawing lazily means a pilot who is 40 sentences deep
 * and one who just launched are reading the same list, no matter how far apart
 * their clients have drifted.
 */
export function buildSequence(seed: number, length = 200): string[] {
  const rng = makeRng(seed);
  const out: string[] = [];
  let last = '';
  for (let i = 0; i < length; i++) {
    let choice: string;
    do {
      choice = SENTENCE_POOL[Math.floor(rng() * SENTENCE_POOL.length)];
    } while (choice === last && SENTENCE_POOL.length > 1);
    out.push(choice);
    last = choice;
  }
  return out;
}
