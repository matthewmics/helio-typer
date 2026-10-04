import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.constants';
import { HASH_TAG } from '../redis/redis.constants';
import { INSTANCE_ID } from '../matchmaking/guest.service';
import { OWNER_TTL_MS, RACE_TTL_S } from './race.config';

/** Same `{mm}` hash tag as matchmaking, so every key stays in one slot. */
const P = `${HASH_TAG}:`;

const KEYS = {
  race: (matchId: string) => `${P}race:${matchId}`,
  owner: (matchId: string) => `${P}race:${matchId}:owner`,
  finish: (matchId: string) => `${P}race:${matchId}:finish`,
};

export interface RacePilotRecord {
  id: string;
  name: string;
  bot: boolean;
  /** Fixed column, assigned once at creation so it never shifts mid-race. */
  lane: number;
}

export interface RaceRecord {
  matchId: string;
  seed: number;
  createdAt: number;
  pilots: RacePilotRecord[];
}

/** What a pilot reports when they cross the line. */
export interface FinishRecord {
  wpm: number;
  accuracy: number;
  completionMs: number;
  progress: number;
}

/**
 * The race record, and who is simulating it.
 *
 * A race has one thing that genuinely cannot be spread across instances: its
 * bots. Two processes both ticking the same bot would double its speed and
 * broadcast two conflicting positions. So exactly one instance owns a match,
 * claimed with SET NX and held by refreshing the key while it ticks.
 *
 * Everything else is deliberately ownerless. A human's cosmetic state is relayed
 * to the room by whichever instance received it, and the socket.io Redis adapter
 * puts it in front of everyone regardless of where they are connected. That means
 * the only cross-instance coordination in a race is this one claim.
 */
@Injectable()
export class RaceService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Store the roster so any instance can answer a join, wherever it lands. */
  async open(record: RaceRecord): Promise<void> {
    await this.redis.set(KEYS.race(record.matchId), JSON.stringify(record), 'EX', RACE_TTL_S);
  }

  async get(matchId: string): Promise<RaceRecord | null> {
    const blob = await this.redis.get(KEYS.race(matchId));
    return blob ? (JSON.parse(blob) as RaceRecord) : null;
  }

  /**
   * Try to become the instance that simulates this match.
   *
   * `NX` makes the claim atomic, so a simultaneous attempt from another process
   * loses cleanly rather than both believing they won.
   */
  async claim(matchId: string): Promise<boolean> {
    const won = await this.redis.set(
      KEYS.owner(matchId),
      INSTANCE_ID,
      'PX',
      OWNER_TTL_MS,
      'NX',
    );
    return won === 'OK';
  }

  /**
   * Keep a claim alive.
   *
   * Only refreshes if this instance still holds it, so a process that paused long
   * enough to lose the claim cannot silently take it back from whoever picked the
   * match up in the meantime.
   */
  async renew(matchId: string): Promise<boolean> {
    const held = await this.redis.get(KEYS.owner(matchId));
    if (held !== INSTANCE_ID) return false;
    await this.redis.pexpire(KEYS.owner(matchId), OWNER_TTL_MS);
    return true;
  }

  async release(matchId: string): Promise<void> {
    const held = await this.redis.get(KEYS.owner(matchId));
    if (held === INSTANCE_ID) await this.redis.del(KEYS.owner(matchId));
  }

  /**
   * Record a finish.
   *
   * Written by whichever instance the pilot is connected to, read by the owner
   * when it builds the standings, which is why it goes through Redis rather than
   * staying in the receiving process.
   */
  async recordFinish(matchId: string, pilotId: string, finish: FinishRecord): Promise<void> {
    await this.redis
      .multi()
      .hset(KEYS.finish(matchId), pilotId, JSON.stringify(finish))
      .expire(KEYS.finish(matchId), RACE_TTL_S)
      .exec();
  }

  async finishes(matchId: string): Promise<Record<string, FinishRecord>> {
    const raw = await this.redis.hgetall(KEYS.finish(matchId));
    const out: Record<string, FinishRecord> = {};
    for (const [id, blob] of Object.entries(raw)) out[id] = JSON.parse(blob) as FinishRecord;
    return out;
  }
}
