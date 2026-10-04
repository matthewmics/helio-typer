import { Module } from '@nestjs/common';
import { GuestService } from './guest.service';

/**
 * Guest identity, on its own so both matchmaking and the race can inject it.
 *
 * Without this the two feature modules would have to import each other:
 * matchmaking needs `RaceService` to open a race when a match confirms, and the
 * race needs `GuestService` to know who a socket belongs to.
 */
@Module({
  providers: [GuestService],
  exports: [GuestService],
})
export class GuestModule {}
