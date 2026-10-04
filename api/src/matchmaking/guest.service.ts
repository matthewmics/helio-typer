import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.constants';
import { KEYS } from './matchmaking.keys';
import { GUEST_TTL_S } from './matchmaking.config';
import { randomCallsign } from './callsigns';

/** Which process this is. Only ever used for logging and debugging a cluster. */
export const INSTANCE_ID = `${hostname()}:${process.pid}`;

export interface Guest {
  guestId: string;
  name: string;
  socketId: string;
}

/**
 * Guest identity: a callsign and an id, with no account behind either.
 *
 * A guest is not an authentication boundary and is not trying to be one. There is
 * nothing to steal: guests are barred from the leaderboard by design, so the
 * worst outcome of a forged identity is racing under someone else's callsign.
 * The `resumeToken` exists for one narrow reason, to let a page refresh keep the
 * same callsign, and it is a separate random value rather than the guestId
 * because the guestId is broadcast to every other pilot in the match roster.
 * Reusing it as the credential would hand every opponent the keys.
 */
@Injectable()
export class GuestService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /**
   * Attach a guest identity to a socket, reusing the previous one when the client
   * presents a token that checks out.
   */
  async identify(
    socketId: string,
    resume?: { guestId?: string; token?: string },
  ): Promise<{ guest: Guest; resumeToken: string }> {
    if (resume?.guestId && resume.token) {
      const [name, token] = await this.redis.hmget(KEYS.guest(resume.guestId), 'name', 'token');
      if (name && token && token === resume.token) {
        await this.bind(resume.guestId, socketId);
        return { guest: { guestId: resume.guestId, name, socketId }, resumeToken: token };
      }
    }

    const guestId = randomUUID();
    const resumeToken = randomUUID();
    const name = randomCallsign();

    await this.redis
      .multi()
      .hset(KEYS.guest(guestId), { name, token: resumeToken, socketId, instanceId: INSTANCE_ID })
      .expire(KEYS.guest(guestId), GUEST_TTL_S)
      .set(KEYS.socket(socketId), guestId, 'EX', GUEST_TTL_S)
      .exec();

    return { guest: { guestId, name, socketId }, resumeToken };
  }

  /** Point an existing guest at a new socket, after a reconnect. */
  private async bind(guestId: string, socketId: string): Promise<void> {
    await this.redis
      .multi()
      .hset(KEYS.guest(guestId), { socketId, instanceId: INSTANCE_ID })
      .expire(KEYS.guest(guestId), GUEST_TTL_S)
      .set(KEYS.socket(socketId), guestId, 'EX', GUEST_TTL_S)
      .exec();
  }

  async bySocket(socketId: string): Promise<Guest | null> {
    const guestId = await this.redis.get(KEYS.socket(socketId));
    if (!guestId) return null;
    const name = await this.redis.hget(KEYS.guest(guestId), 'name');
    if (!name) return null;
    return { guestId, name, socketId };
  }

  /**
   * Detach a socket without destroying the identity.
   *
   * The guest hash is deliberately left to expire on its own rather than being
   * deleted here. A disconnect is usually a refresh or a flaky connection, and
   * deleting on the way out would mean the same person comes back as a stranger
   * with a new callsign.
   */
  async detach(socketId: string): Promise<void> {
    await this.redis.del(KEYS.socket(socketId));
  }

  /** Which match this guest is sitting in a ready check for, if any. */
  async currentMatch(guestId: string): Promise<string | null> {
    return this.redis.get(KEYS.guestMatch(guestId));
  }
}
