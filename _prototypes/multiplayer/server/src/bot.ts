import { Race } from './shared/race';
import type { BotConfig } from './shared/config';

/**
 * A bot pilot: a `Race` plus a typist driving it.
 *
 * Bots exist because a multiplayer prototype you can only evaluate by opening six
 * browser tabs is a prototype nobody evaluates. With bots, one tab shows a full
 * six-pilot field immediately.
 *
 * They are also the honest way to test the netcode: a bot's `Race` runs on the
 * server and its state reaches the browser through the exact same snapshot stream
 * a remote human would use, so if interpolation is broken, the bots show it.
 */
export class BotPilot {
  readonly id: string;
  readonly name: string;
  readonly race: Race;

  /**
   * Wall-clock seconds since the race began, stalls included.
   *
   * Deliberately not `race.elapsed`, which excludes stall time so that WPM is not
   * dragged down by a lockout the pilot could not have typed through. Completion
   * time is the opposite measure: the whole run, every stall counted, which is
   * exactly what makes it worth ranking separately from WPM.
   */
  wallElapsed = 0;

  /** Seconds between keystrokes, derived from the bot's target WPM. */
  private _interval: number;
  private _cooldown: number;
  private _errorRate: number;
  private _rng: () => number;

  constructor(id: string, name: string, seed: number, cfg: BotConfig, rng: () => number) {
    this.id = id;
    this.name = name;
    this.race = new Race(seed);
    this._rng = rng;

    const wpm = cfg.wpmMin + rng() * (cfg.wpmMax - cfg.wpmMin);
    // WPM is defined as characters/5 per minute, so chars/sec is wpm*5/60 and the
    // gap between keystrokes is its reciprocal.
    this._interval = 1 / ((wpm * 5) / 60);
    this._errorRate = cfg.errorRate;
    // Stagger the first keystroke so six bots do not launch on the same frame.
    this._cooldown = rng() * 0.8;
  }

  update(dt: number): void {
    if (this.race.phase !== 'finished') this.wallElapsed += dt;
    this.race.update(dt);
    if (this.race.phase !== 'racing') return;

    this._cooldown -= dt;
    while (this._cooldown <= 0 && this.race.phase === 'racing') {
      this._press();
      // Humanise the cadence a little, otherwise a bot's WPM is a perfectly flat
      // line and the results table looks obviously synthetic.
      this._cooldown += this._interval * (0.75 + this._rng() * 0.5);
    }
  }

  private _press(): void {
    const expected = this.race.sentence[this.race.typedIndex];
    if (expected === undefined) return;
    if (this._rng() < this._errorRate) {
      // Any wrong character will do. 'x' is wrong often enough to be a mistake and
      // occasionally right, which is a fine approximation of a real fumble.
      this.race.typeKey(expected === 'x' ? 'q' : 'x');
      return;
    }
    this.race.typeKey(expected);
  }
}
