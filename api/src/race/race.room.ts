import { BotPilot, botRng } from './bot';
import { MAX_DT, RACE_MAX_MS, ROOM_LINGER_MS } from './race.config';
import type { RaceRecord } from './race.service';
import type { PilotState } from './race.protocol';

/** A bot crossing the line, as the owner announces it. */
export interface BotFinish {
  id: string;
  completionMs: number;
  wpm: number;
  accuracy: number;
  mistakes: number;
}

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

  /** When the race starts, on the server clock. Null until it is set. See `schedule`. */
  private _startAt: number | null = null;
  private _lastTick = Date.now();
  /** Set once every pilot is done, so the room can be reaped after a grace period. */
  private _endedAt: number | null = null;

  /** Pilots the owner has seen finish, humans included, by id. */
  readonly finished = new Set<string>();
  /** Bots that crossed since the owner last asked. See `takeBotFinishes`. */
  private readonly _botFinishes: BotFinish[] = [];

  constructor(record: RaceRecord) {
    this.matchId = record.matchId;
    this.record = record;

    const rng = botRng(record.seed);
    this.bots = record.pilots
      .filter((p) => p.bot)
      .map((p) => new BotPilot(p.id, p.name, record.seed, rng));
  }

  get scheduled(): boolean {
    return this._startAt !== null;
  }

  /** True once the countdown has run out. */
  started(now = Date.now()): boolean {
    return this._startAt !== null && now >= this._startAt;
  }

  /**
   * Set the start. The bots hold on the pad until then.
   *
   * It used to be the first human to arrive, which was not fair: pages load at
   * different speeds, so the bots and whoever loaded first got a head start on
   * everyone else. The start is now set once every human is connected, a
   * countdown out, and every pilot is handed the same one.
   */
  schedule(startAt: number): void {
    if (this._startAt === null) this._startAt = startAt;
  }

  tick(now = Date.now()): void {
    if (this._startAt === null || this._endedAt !== null || now < this._startAt)
      return;

    // Measured from the start, not the last tick, on the first step after it,
    // so time spent waiting on the pad never counts as flying.
    const dt = Math.min(
      MAX_DT,
      (now - Math.max(this._lastTick, this._startAt)) / 1000,
    );
    this._lastTick = now;

    for (const bot of this.bots) {
      bot.update(dt);
      if (bot.race.phase === 'finished' && !this.finished.has(bot.id)) {
        this.finished.add(bot.id);
        this._botFinishes.push({
          id: bot.id,
          completionMs: Math.round(bot.wallElapsed * 1000),
          wpm: bot.race.wpm,
          accuracy: bot.race.accuracy,
          mistakes: bot.race.mistakes,
        });
      }
    }

    if (this.finished.size >= this.record.pilots.length) {
      this._endedAt = now;
    } else if (now - this._startAt > RACE_MAX_MS) {
      // A pilot who walked away mid-run would otherwise hold this room, and its
      // bots, alive forever.
      this._endedAt = now;
    }
  }

  /** Bots that crossed since the last call, for the owner to announce. */
  takeBotFinishes(): BotFinish[] {
    return this._botFinishes.splice(0);
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

  /**
   * A pilot the race started without, because they never connected.
   *
   * Counted as done so the race closes when everyone who did fly has crossed,
   * rather than waiting out RACE_MAX_MS for someone who is not coming. With no
   * finish banked, they place as a DNF.
   */
  markAbsent(pilotId: string, now = Date.now()): void {
    this.markFinished(pilotId, now);
  }

  /** Wall-clock ms since the start, which is what a completion time measures. */
  elapsedMs(now = Date.now()): number {
    return this._startAt === null ? 0 : Math.max(0, now - this._startAt);
  }
}
