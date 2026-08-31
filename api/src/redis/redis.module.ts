import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS } from './redis.constants';

export function createRedisClient(name: string): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const log = new Logger(`Redis:${name}`);
  const client = new Redis(url, {
    // Fail fast rather than queueing commands forever behind a dead Redis.
    // Matchmaking keeps no in-memory fallback by design, so a silent command
    // backlog would present as a hung queue rather than as an outage.
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
  client.on('error', (err: Error) => log.error(err.message));
  return client;
}

/**
 * The one shared Redis connection, injected as `REDIS`.
 *
 * Global, like `PrismaModule`, so a feature module does not have to import it in
 * order to inject the client.
 *
 * The socket.io adapter deliberately does not reuse this connection. A client
 * running pub/sub is put into subscriber mode and can no longer issue ordinary
 * commands, so the adapter creates its own pair in `redis-io.adapter.ts` while
 * this one stays free for reads and writes.
 */
@Global()
@Module({
  providers: [{ provide: REDIS, useFactory: () => createRedisClient('main') }],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
