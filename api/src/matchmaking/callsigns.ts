/**
 * Random callsigns for guests and bots.
 *
 * Guests never pick a name, so the generator has to produce something a player is
 * happy to be called for the length of one race, on the first try, with no
 * profanity surface and no input to validate.
 *
 * The numeric suffix is not decoration. It is what lets this run on a clustered
 * app with no coordination at all: with these pools the space is large enough
 * that two live guests colliding is rare, and a collision is cosmetic anyway. The
 * alternative, a reserved-names set in Redis, would need a release path on every
 * disconnect and would leak an entry every time a process died between the two.
 * Duplicate callsigns are a better failure than a set that grows forever.
 */

const PREFIXES = [
  'Solar', 'Ion', 'Nova', 'Orbit', 'Comet', 'Lunar', 'Astro', 'Vector',
  'Delta', 'Photon', 'Quasar', 'Nebula', 'Cinder', 'Aurora', 'Zenith',
  'Drift', 'Halo', 'Vapor', 'Echo', 'Pulsar', 'Cobalt', 'Ember', 'Quiet',
  'Silent', 'Rapid', 'Sable', 'Vernal', 'Aphelion', 'Kestrel', 'Umbra',
];

const SUFFIXES = [
  'Runner', 'Drifter', 'Pilot', 'Lark', 'Falcon', 'Wren', 'Kite', 'Sparrow',
  'Voyager', 'Ranger', 'Scout', 'Nomad', 'Courier', 'Skiff', 'Cutter',
  'Lancer', 'Marlin', 'Sable', 'Vane', 'Wake', 'Arc', 'Spire', 'Vector',
  'Trace', 'Ghost', 'Bolt', 'Signal', 'Ripple', 'Fathom', 'Zephyr',
];

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** A single callsign, for example `IonKestrel-4821`. */
export function randomCallsign(): string {
  const n = 1000 + Math.floor(Math.random() * 9000);
  return `${pick(PREFIXES)}${pick(SUFFIXES)}-${n}`;
}

/**
 * `count` callsigns guaranteed distinct from each other and from `taken`.
 *
 * Used for the bots filling one lobby, where a duplicate would be conspicuous in
 * a way it is not across the whole playerbase: six rockets on one screen, two of
 * them with the same name, reads as a bug.
 */
export function distinctCallsigns(count: number, taken: readonly string[] = []): string[] {
  const seen = new Set(taken);
  const out: string[] = [];
  while (out.length < count) {
    const name = randomCallsign();
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
