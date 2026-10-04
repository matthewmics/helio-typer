import {
  DEFAULT_ROCKET,
  Race,
  ROCKET_IDS,
  makeRng,
  type RocketId,
} from '@heliotyper/engine';
import { BOT_ERROR_RATE, BOT_WPM_MAX, BOT_WPM_MIN } from './race.config';
import type { PilotState } from './race.protocol';

/**
 * A bot pilot: a `Race` plus a typist driving it.
 *
 * Bots run the *same* `Race` class the browser runs, from the same package. That
 * is the whole reason the engine was pulled out of `web/`: a second
 * implementation on the server would be a second thing to keep in step, and the
 * divergence would show up as a bot that quietly obeys different physics from
 * the human racing it.
 *
 * Their state reaches the browser through the same snapshot stream a remote
 * human's does, so if interpolation is broken the bots show it.
 */
export class BotPilot {
  readonly id: string;
  readonly name: string;
  readonly race: Race;

  /**
   * Wall-clock seconds since the race began, stalls included.
   *
   * Deliberately not `race.elapsed`, which excludes stall time so WPM is not
   * dragged down by a lockout the pilot could not type through. Completion time
   * is the opposite measure: the whole run, every stall counted.
   */
  wallElapsed = 0;

  /** Seconds between keystrokes, from the bot's target WPM. */
  private readonly _interval: number;
  private readonly _errorRate: number;
  private readonly _rng: () => number;
  private _cooldown: number;

  constructor(id: string, name: string, seed: number, rng: () => number) {
    this.id = id;
    this.name = name;
    // Same seed as everyone else in the match, so a bot types the same passage
    // the humans do rather than racing a private one.
    this.race = new Race(seed);
    this._rng = rng;

    const wpm = BOT_WPM_MIN + rng() * (BOT_WPM_MAX - BOT_WPM_MIN);
    // WPM is characters/5 per minute, so chars per second is wpm*5/60 and the gap
    // between keystrokes is its reciprocal.
    this._interval = 1 / ((wpm * 5) / 60);
    this._errorRate = BOT_ERROR_RATE;
    // Stagger the first keystroke so the field does not launch on one frame.
    this._cooldown = rng() * 0.9;
  }

  update(dt: number): void {
    if (this.race.phase !== 'finished') this.wallElapsed += dt;
    this.race.update(dt);
    if (this.race.phase !== 'racing') return;

    this._cooldown -= dt;
    while (this._cooldown <= 0 && this.race.phase === 'racing') {
      this._press();
      // Humanise the cadence, otherwise a bot's WPM is a perfectly flat line and
      // the standings look obviously synthetic.
      this._cooldown += this._interval * (0.75 + this._rng() * 0.5);
    }
  }

  private _press(): void {
    const expected = this.race.expected;
    if (expected === undefined) return;
    if (this._rng() < this._errorRate) {
      // Any wrong character will do. 'x' is wrong often enough to be a mistake
      // and occasionally right, which is a fine approximation of a real fumble.
      this.race.typeKey(expected === 'x' ? 'q' : 'x');
      return;
    }
    this.race.typeKey(expected);
  }

  state(now: number): PilotState {
    const r = this.race;
    return {
      t: now,
      progress: r.progress,
      speed: r.speed,
      speedRatio: r.speedRatio,
      tier: r.tier,
      hull: r.hull,
      phase: r.phase,
      launched: r.launched,
      launchT: r.launchT,
      wpm: r.wpm,
      stallTimer: r.stallTimer,
      mistakes: r.mistakes,
    };
  }
}

/** One RNG per match, so a given seed always produces the same field of bots. */
export function botRng(seed: number): () => number {
  // Offset the seed so the bot draw does not walk the same stream the passage
  // pick does. Same seed, independent sequence.
  return makeRng(seed ^ 0x5f3759df);
}

/**
 * A ship for every seat in the lobby, shuffled from the match seed, so a given
 * match always fields the same rockets. Only the bots' seats are used.
 *
 * Never the default, which is what every human flies for now, and never the
 * same ship twice while there are ships to go round. The whole point is a field
 * that looks like different pilots rather than a row of copies.
 */
export function seatShips(seed: number, seats: number): RocketId[] {
  // Its own stream again, so ships do not shift if the bot draw ever changes.
  const rng = makeRng(seed ^ 0x2c1b3c6d);
  const pool = ROCKET_IDS.filter((id) => id !== DEFAULT_ROCKET);
  // Fisher-Yates, so every ship is equally likely in every seat.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: seats }, (_, i) => pool[i % pool.length]);
}
