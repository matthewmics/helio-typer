import { BotPilot, botRng } from './bot';
import { MAX_DT, RACE_MAX_MS, ROOM_LINGER_MS } from './race.config';
import type { RaceRecord } from './race.service';
import type { PilotState } from './race.protocol';

/**
 * One match being simulated, in the memory of the instance that owns it.
 *
 * The server holds a `Race` per bot and deliberately **not** per human. Humans
 * simulate locally, because input cannot wait on a round trip: at 100+ WPM a key
 * lands roughly every 120ms, well inside typical WebSocket latency, so gating
 * feedback on the server would feel sluggish to exactly the players who notice
 * most. The server's job for a human is to relay their state and bank what they
 * report at the finish.
 */
export class RaceRoom {
  readonly matchId: string;
  readonly record: RaceRecord;
  readonly bots: BotPilot[];

  /** Null until the first human joins. See `start`. */
  private _startedAt: number | null = null;
  private _lastTick = Date.now();
  /** Set once every pilot is done, so the room can be reaped after a grace period. */
  private _endedAt: number | null = null;

  /** Pilots the owner has seen finish, humans included, by id. */
  readonly finished = new Set<string>();

  constructor(record: RaceRecord) {
    this.matchId = record.matchId;
    this.record = record;

    const rng = botRng(record.seed);
    this.bots = record.pilots
      .filter((p) => p.bot)
      .map((p) => new BotPilot(p.id, p.name, record.seed, rng));
  }

  get started(): boolean {
    return this._startedAt !== null;
  }

  get startedAt(): number | null {
    return this._startedAt;
  }

  /**
   * Begin simulating, on the first human to arrive.
   *
   * Not at match confirmation: the browser has a page to load and an engine to
   * boot between accepting and being ready, and bots that started at confirm
   * would already be a few seconds up the run by the time the human sees the pad.
   */
  start(now = Date.now()): void {
    if (this._startedAt !== null) return;
    this._startedAt = now;
    this._lastTick = now;
  }

  tick(now = Date.now()): void {
    if (this._startedAt === null || this._endedAt !== null) return;

    const dt = Math.min(MAX_DT, (now - this._lastTick) / 1000);
    this._lastTick = now;

    for (const bot of this.bots) {
      bot.update(dt);
      if (bot.race.phase === 'finished') this.finished.add(bot.id);
    }

    if (this.finished.size >= this.record.pilots.length) {
      this._endedAt = now;
    } else if (now - this._startedAt > RACE_MAX_MS) {
      // A pilot who walked away mid-run would otherwise hold this room, and its
      // bots, alive forever.
      this._endedAt = now;
    }
  }

  /** Snapshot of the pilots this instance simulates. Humans report their own. */
  botStates(now = Date.now()): Record<string, PilotState> {
    const out: Record<string, PilotState> = {};
    for (const bot of this.bots) out[bot.id] = bot.state(now);
    return out;
  }

  get ended(): boolean {
    return this._endedAt !== null;
  }

  /** True once the room has been finished long enough to drop. */
  reapable(now = Date.now()): boolean {
    return this._endedAt !== null && now - this._endedAt > ROOM_LINGER_MS;
  }

  markFinished(pilotId: string, now = Date.now()): void {
    this.finished.add(pilotId);
    if (this.finished.size >= this.record.pilots.length) this._endedAt = now;
  }

  /** Wall-clock ms since the start, which is what a completion time measures. */
  elapsedMs(now = Date.now()): number {
    return this._startedAt === null ? 0 : now - this._startedAt;
  }
}
