import { Module } from '@nestjs/common';
import { GuestModule } from '../matchmaking/guest.module';
import { RaceGateway } from './race.gateway';
import { RaceService } from './race.service';

@Module({
  imports: [GuestModule],
  providers: [RaceGateway, RaceService],
  exports: [RaceService],
})
export class RaceModule {}
