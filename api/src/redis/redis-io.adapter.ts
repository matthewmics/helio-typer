import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';
import { createRedisClient } from './redis.module';

/**
 * The socket.io adapter that makes this app safe to run as more than one process.
 *
 * Without it every instance holds its own isolated set of rooms, so
 * `server.to(room).emit()` only reaches the sockets that happen to have landed on
 * that instance. Two guests in the same match connected to different workers
 * would simply not see each other. The Redis adapter relays room emits, and the
 * cluster-wide `socketsJoin` / `fetchSockets` calls matchmaking depends on,
 * through Redis pub/sub.
 *
 * Note what this does NOT solve: the adapter shares *messages*, not *state*. All
 * queue and ready-check state lives in Redis keys precisely because no instance
 * can be trusted to hold it.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly log = new Logger('RedisIoAdapter');
  private pub!: Redis;
  private sub!: Redis;
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connect(): Promise<void> {
    this.pub = createRedisClient('io-pub');
    // A subscriber connection cannot issue normal commands, which is why this is
    // a separate socket rather than a second use of the publisher.
    this.sub = this.pub.duplicate();
    await Promise.all([this.pub.ping(), this.sub.ping()]);
    this.adapterConstructor = createAdapter(this.pub, this.sub);
    this.log.log('socket.io redis adapter connected');
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: '*' },
      // WebSocket only, deliberately.
      //
      // socket.io's HTTP long-polling transport spreads a single logical
      // connection over many HTTP requests, so behind a load balancer every one
      // of those requests has to reach the same instance. That means sticky
      // sessions, which is an extra thing to configure correctly in Traefik and
      // an extra thing to get silently wrong. A raw WebSocket is one connection
      // held open against one instance for its whole life, so it needs no
      // stickiness at all. The cost is dropping support for clients that cannot
      // open a WebSocket, which for a browser typing game is nobody.
      transports: ['websocket'],
    });
    server.adapter(this.adapterConstructor);
    return server;
  }

  async close(): Promise<void> {
    await Promise.all([
      this.pub?.quit().catch(() => this.pub?.disconnect()),
      this.sub?.quit().catch(() => this.sub?.disconnect()),
    ]);
  }
}
