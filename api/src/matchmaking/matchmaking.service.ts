import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.constants';
import { KEYS, PREFIX } from './matchmaking.keys';
import { DECIDE, FORM_MATCH, SWEEP_EXPIRED } from './matchmaking.scripts';
import { distinctCallsigns } from './callsigns';
import {
  BOT_FILL_AFTER_MS,
  LOBBY_SIZE,
  READY_CHECK_MS,
  SWEEP_BATCH,
} from './matchmaking.config';
import type { MatchPilot, PilotStatus, QueueStatusMsg } from './matchmaking.protocol';

/** One pilot as the Lua scripts store them. `socketId` never leaves the server. */
export interface MatchPlayerRecord {
  id: string;
  name: string;
  socketId: string;
  bot: boolean;
  status: PilotStatus;
  /** Original enqueue time, kept so a requeue restores their place in line. */
  score: number;
  /** Set only on a failed match: whether this pilot went back into the queue. */
  requeued?: boolean;
}

export interface MatchRecord {
  id: string;
  createdAt: number;
  deadline: number;
  state: 'open' | 'confirmed' | 'failed';
  reason?: 'declined' | 'timeout';
  seed: number;
  players: MatchPlayerRecord[];
}

export type DecideOutcome =
  | 'accepted'
  | 'confirmed'
  | 'failed'
  | 'gone'
  | 'closed'
  | 'not_in_match';

export interface DecideResult {
  outcome: DecideOutcome;
  match?: MatchRecord;
}

/** ioredis grows a method per `defineCommand`, which its types cannot know about. */
interface ScriptedRedis extends Redis {
  mmFormMatch(...args: (string | number)[]): Promise<string | null>;
  mmDecide(...args: (string | number)[]): Promise<string>;
  mmSweep(...args: (string | number)[]): Promise<string[]>;
}

/**
 * Queue, ready check, and bot fill. All state lives in Redis, none in this class.
 *
 * That is not incidental. Holding the queue in a `Map` here would work perfectly
 * until the second instance started, at which point there would be two queues
 * that never see each other and guests would match only with whoever landed on
 * the same worker. Every method below is a thin wrapper over a Lua script for the
 * same reason: see the header of `matchmaking.scripts.ts`.
 */
@Injectable()
export class MatchmakingService implements OnModuleInit {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private get r(): ScriptedRedis {
    return this.redis as ScriptedRedis;
  }

  onModuleInit(): void {
    // `defineCommand` registers the script once and then invokes it by SHA with
    // an automatic fallback to EVAL if Redis has forgotten it, which is what
    // makes this safe across a Redis restart without any bookkeeping here.
    this.redis.defineCommand('mmFormMatch', { numberOfKeys: 2, lua: FORM_MATCH });
    this.redis.defineCommand('mmDecide', { numberOfKeys: 2, lua: DECIDE });
    this.redis.defineCommand('mmSweep', { numberOfKeys: 2, lua: SWEEP_EXPIRED });
  }

  // -------------------------------------------------------------------------
  // Queue
  // -------------------------------------------------------------------------

  /**
   * Put a guest in line.
   *
   * `NX` so a double click, or a client that resends on reconnect, does not reset
   * an existing wait and push the guest to the back of a queue they were already
   * near the front of.
   */
  async enqueue(guestId: string): Promise<void> {
    await this.redis.zadd(KEYS.queue, 'NX', Date.now(), guestId);
  }

  async dequeue(guestId: string): Promise<void> {
    await this.redis.zrem(KEYS.queue, guestId);
  }

  async queueStatus(guestId: string): Promise<QueueStatusMsg> {
    const [rank, score, waiting, matchId] = await Promise.all([
      this.redis.zrank(KEYS.queue, guestId),
      this.redis.zscore(KEYS.queue, guestId),
      this.redis.zcard(KEYS.queue),
      this.redis.get(KEYS.guestMatch(guestId)),
    ]);

    const state: QueueStatusMsg['state'] = matchId ? 'ready_check' : rank === null ? 'idle' : 'queued';
    return {
      state,
      position: rank === null ? null : rank + 1,
      waiting,
      queuedAt: score === null ? null : Number(score),
      now: Date.now(),
    };
  }

  // -------------------------------------------------------------------------
  // Match formation
  // -------------------------------------------------------------------------

  /**
   * Try to form one match. Safe to call from every instance simultaneously.
   *
   * Returns null far more often than not, which is the normal case: an empty
   * queue, or people waiting who have not yet earned their bots.
   */
  async tryFormMatch(): Promise<MatchRecord | null> {
    const matchId = randomUUID();
    // Bot names are generated here rather than in Lua so there is one callsign
    // generator, and because a Lua script must be deterministic to stay safe for
    // replication: rolling random names inside it would be exactly the kind of
    // non-determinism that makes a script unsafe to ship to a replica.
    const botNames = JSON.stringify(distinctCallsigns(LOBBY_SIZE));
    const seed = Math.floor(Math.random() * 1e9);

    const blob = await this.r.mmFormMatch(
      KEYS.queue,
      KEYS.matchIndex,
      Date.now(),
      LOBBY_SIZE,
      BOT_FILL_AFTER_MS,
      matchId,
      READY_CHECK_MS,
      PREFIX,
      botNames,
      seed,
    );

    return blob ? (JSON.parse(blob) as MatchRecord) : null;
  }

  // -------------------------------------------------------------------------
  // Ready check
  // -------------------------------------------------------------------------

  async decide(matchId: string, guestId: string, action: 'accept' | 'decline'): Promise<DecideResult> {
    const raw = await this.r.mmDecide(KEYS.queue, KEYS.matchIndex, matchId, guestId, action, PREFIX);
    return JSON.parse(raw) as DecideResult;
  }

  /** Fail every ready check whose deadline has passed. Safe on every instance. */
  async sweepExpired(): Promise<MatchRecord[]> {
    const blobs = await this.r.mmSweep(
      KEYS.matchIndex,
      KEYS.queue,
      Date.now(),
      PREFIX,
      SWEEP_BATCH,
    );
    return blobs.map((b) => JSON.parse(b) as MatchRecord);
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------

  /**
   * The roster as clients see it.
   *
   * Drops `socketId`, which is server business, and `bot`, which is nobody's
   * business on the wire. See the note on {@link MatchPilot}.
   */
  static publicPilots(match: MatchRecord): MatchPilot[] {
    return match.players.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
    }));
  }

  static acceptedCount(match: MatchRecord): number {
    return match.players.filter((p) => p.status === 'accepted').length;
  }
}
