import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis/redis-io.adapter';

declare const module: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Must be installed before `listen`, since that is when the socket.io server
  // is created. Without it each instance would keep its own private set of rooms
  // and two guests in one match could sit on different workers, unable to see
  // each other.
  const adapter = new RedisIoAdapter(app);
  await adapter.connect();
  app.useWebSocketAdapter(adapter);

  // Lets `onApplicationShutdown` and `onModuleDestroy` actually run, which is
  // what closes the Redis connections and stops the matchmaking timers instead
  // of leaving a half-dead worker holding them.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
