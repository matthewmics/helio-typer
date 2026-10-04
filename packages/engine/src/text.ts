/**
 * Typing content: one philosophy passage per race.
 *
 * A race types a single passage rather than a stream of separate sentences,
 * so the text reads as one continuous piece. A passage can be any length: a
 * race that outlasts it loops it (`Race.lap`), so there is no end of text to
 * pace the race against and `raceDistance` alone sets how long a run takes.
 *
 * All of it typeable on a plain keyboard: no smart quotes, no dashes, no
 * ellipses. There is no admin site yet, so the passages live here in code.
 *
 * Adapted from public domain translations, lightly modernized ("thou" becomes
 * "you") and trimmed: George Long for Marcus Aurelius and the Discourses of
 * Epictetus, T. W. Higginson for the Enchiridion, James Legge for the Tao Te
 * Ching. The popular modern translations are still in copyright, so none of
 * their wording is used.
 */
export const PASSAGES: readonly string[] = [
  // Firmness. Opens with Seneca, On the Firmness of the Wise Man, asked for by
  // name and kept word for word, then Marcus Aurelius IV.49, VIII.47, V.16, VII.59.
  'Bound upon me, rush upon me, I will overcome you by enduring your onset. Whatever strikes against that which is firm and unconquerable merely injures itself by its own violence. Wherefore, seek some soft and yielding object to pierce with your darts. Be like the promontory against which the waves continually break, but it stands firm and tames the fury of the water around it. It is not the thing itself that disturbs you, but your own judgement about it. And it is in your power to wipe out that judgement now. Such as are your habitual thoughts, such also will be the character of your mind, for the soul is dyed by the thoughts. Look within. Within is the fountain of good, and it will ever bubble up, if you will ever dig.',

  // Marcus Aurelius, Meditations II.1, IV.17, X.16, VI.6, VII.67, II.11.
  'Begin the morning by saying to yourself, I shall meet with the busybody, the ungrateful, the arrogant, the deceitful, the envious and the unsocial. All these things happen to them by reason of their ignorance of what is good and evil. Do not act as if you were going to live ten thousand years. Death hangs over you. While you live, while it is in your power, be good. No longer talk at all about the kind of man that a good man ought to be, but be such. The best way of avenging yourself is not to become like the wrongdoer. Remember this, that very little indeed is necessary for living a happy life. Since it is possible that you may depart from life this very moment, regulate every act and thought accordingly.',

  // Epictetus, Enchiridion 1, 5 and 8, then the Discourses and the fragments.
  'Some things are in our control and others not. Things in our control are opinion, pursuit, desire, aversion, and in a word, whatever are our own actions. Things not in our control are body, property, reputation and command. Men are disturbed not by things, but by the principles and notions which they form concerning things. Do not demand that things happen as you wish, but wish them to happen as they do happen, and you will go on well. First say to yourself what you would be, and then do what you have to do. Difficulties are things that show what men are. It is impossible for a man to learn what he thinks he already knows. No man is free who is not master of himself.',

  // Tao Te Ching 78, 15, 33, 64 and 8.
  'There is nothing in the world more soft and weak than water, and yet for attacking things that are firm and strong there is nothing that can take precedence of it. Everyone knows that the soft overcomes the hard, and the weak the strong. Who can make the muddy water clear? Let it be still, and it will gradually become clear. He who knows other men is discerning, and he who knows himself is intelligent. He who overcomes others is strong, and he who overcomes himself is mighty. He who is satisfied with his lot is rich. The journey of a thousand li begins with a single step. The highest excellence is like that of water, which benefits all things and occupies, without striving, the low place which all men dislike.',
];

/**
 * Mulberry32.
 *
 * Chosen because it is tiny and, more importantly, produces an identical stream
 * from the same seed in every JS runtime. A race is only fair if the browser and
 * the server agree on the text from the seed alone, and `Math.random` gives no
 * such guarantee across engines or even across runs.
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
 * The passage a race is typed from, drawn from its seed, so every pilot in the
 * race, bots included, types the same one without it ever being sent.
 */
export function passageFor(seed: number): string {
  return PASSAGES[Math.floor(makeRng(seed)() * PASSAGES.length)];
}
