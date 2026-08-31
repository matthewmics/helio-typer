import { Module } from '@nestjs/common';
import { MatchmakingGateway } from './matchmaking.gateway';
import { MatchmakingService } from './matchmaking.service';
import { GuestService } from './guest.service';

/** Needs no imports: `RedisModule` is global, the same way `PrismaModule` is. */
@Module({
  providers: [MatchmakingGateway, MatchmakingService, GuestService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
