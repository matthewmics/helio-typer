import { Module } from '@nestjs/common';
import { MatchmakingGateway } from './matchmaking.gateway';
import { MatchmakingService } from './matchmaking.service';
import { GuestModule } from './guest.module';
import { RaceModule } from '../race/race.module';

/** `RedisModule` is global, the same way `PrismaModule` is, so it is not imported. */
@Module({
  imports: [GuestModule, RaceModule],
  providers: [MatchmakingGateway, MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
