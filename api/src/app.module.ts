import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';

@Module({
  imports: [PrismaModule, RedisModule, MatchmakingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
