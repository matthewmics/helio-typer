/**
 * Typing content.
 *
 * The canvas prototype ran on three throwaway sentences to keep dev laps short.
 * protoype.md flags swapping those for real 200-260 character paragraphs, so
 * these are the real thing: prose at the length a race will actually use, all of
 * it typeable on a plain keyboard (no smart quotes, no dashes, no ellipses).
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
 * Typing is endless. Every paragraph is flattened into one pool and sentences keep
 * coming until the ship reaches the heliopause, so there is no "end of text" and
 * therefore no text length to pace the race against. `raceDistance` is the only
 * thing that sets how long a run takes.
 */
export const SENTENCE_POOL: readonly string[] = PARAGRAPHS.flatMap(splitSentences);

/** Draw a sentence, never repeating the one just finished. */
export function pickSentence(exclude: string | null): string {
  if (SENTENCE_POOL.length === 1) return SENTENCE_POOL[0];
  let choice: string;
  do {
    choice = SENTENCE_POOL[Math.floor(Math.random() * SENTENCE_POOL.length)];
  } while (choice === exclude);
  return choice;
}
