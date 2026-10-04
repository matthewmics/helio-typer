import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { GuestService } from '../matchmaking/guest.service';
import { RaceService, type RaceRecord } from './race.service';
import { RaceRoom } from './race.room';
import { SNAPSHOT_HZ, TICK_HZ } from './race.config';
import {
  RACE_EVENTS,
  type PilotEventMsg,
  type PilotKeysMsg,
  type PilotState,
  type RacePilotInfo,
  type ResultRow,
} from './race.protocol';

/** What this instance remembers about one socket that joined a race. */
interface Seat {
  matchId: string;
  pilotId: string;
  name: string;
  /** Latest cosmetic state, kept only to build a result if they never finish. */
  last: PilotState | null;
}

/**
 * The in-race surface: relay, simulate, and score.
 *
 * Two kinds of traffic, handled differently on purpose:
 *
 *   - **A human's state and events are relayed, never validated.** They go
 *     straight to the match room, which the Redis adapter puts in front of every
 *     pilot wherever they are connected. Nothing is stored, so a client lying
 *     here only makes its own rocket look wrong on other screens.
 *   - **Bots are simulated by exactly one instance**, the one holding the claim
 *     in `RaceService`. Two processes ticking the same bot would double its
 *     speed and broadcast two conflicting positions for it.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class RaceGateway implements OnGatewayInit, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger('Race');

  /** Matches this instance simulates. Others are relayed but not ticked here. */
  private readonly owned = new Map<string, RaceRoom>();
  /** Sockets on this instance that are in a race. */
  private readonly seats = new Map<string, Seat>();

  private timers: NodeJS.Timeout[] = [];
  private sinceBroadcast = 0;
  private lastLoop = Date.now();

  constructor(
    private readonly guests: GuestService,
    private readonly races: RaceService,
  ) {}

  afterInit(): void {
    this.timers.push(setInterval(() => void this.loop(), 1000 / TICK_HZ));
    this.log.log(`race loop up at ${TICK_HZ}Hz, broadcasting at ${SNAPSHOT_HZ}Hz`);
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    // Hand every claim back rather than making the next owner wait out the TTL.
    // Catching matters here more than anywhere: this runs during shutdown, when
    // the Redis connection is already going away.
    for (const matchId of this.owned.keys()) {
      void this.races.release(matchId).catch(() => undefined);
    }
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  private async loop(): Promise<void> {
    try {
      await this.step();
    } catch (err) {
      // Fired with `void`, so an escaping rejection is an unhandled rejection and
      // takes the whole process down. Redis commands in flight when the
      // connection closes reject exactly like this, which is not worth a crash.
      this.log.error(`race loop failed: ${(err as Error).message}`);
    }
  }

  private async step(): Promise<void> {
    const now = Date.now();
    const dt = (now - this.lastLoop) / 1000;
    this.lastLoop = now;

    for (const room of this.owned.values()) room.tick(now);

    this.sinceBroadcast += dt;
    const interval = 1 / SNAPSHOT_HZ;
    if (this.sinceBroadcast < interval) return;
    // Carry the remainder rather than resetting to zero. Zeroing throws away the
    // overshoot every broadcast, which compounds into a measurably slower rate
    // than the setting asks for.
    this.sinceBroadcast = Math.min(this.sinceBroadcast - interval, interval);

    for (const [matchId, room] of this.owned) {
      if (!room.started) continue;

      if (room.bots.length > 0) {
        this.server
          .to(this.room(matchId))
          .emit(RACE_EVENTS.snapshot, { t: now, pilots: room.botStates(now) });
      }

      if (room.ended) {
        await this.publishResults(matchId, room);
        this.owned.delete(matchId);
        await this.races.release(matchId);
        this.log.log(`race ${matchId.slice(0, 8)} complete`);
        continue;
      }

      // Losing the claim means another instance believes it owns this match, so
      // stop simulating rather than fighting it.
      if (!(await this.races.renew(matchId))) {
        this.owned.delete(matchId);
        this.log.warn(`race ${matchId.slice(0, 8)} claim lapsed, stopping simulation`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Joining
  // -------------------------------------------------------------------------

  @SubscribeMessage(RACE_EVENTS.join)
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() msg: { matchId?: string },
  ): Promise<void> {
    const matchId = msg?.matchId;
    if (!matchId) return;

    const guest = await this.guests.bySocket(client.id);
    if (!guest) return;

    const record = await this.races.get(matchId);
    if (!record) {
      this.log.warn(`join for unknown race ${matchId.slice(0, 8)}`);
      return;
    }

    const me = record.pilots.find((p) => p.id === guest.guestId);
    if (!me) {
      this.log.warn(`${guest.name} tried to join a race they are not in`);
      return;
    }

    await client.join(this.room(matchId));
    this.seats.set(client.id, {
      matchId,
      pilotId: guest.guestId,
      name: guest.name,
      last: null,
    });

    const pilots: RacePilotInfo[] = record.pilots.map((p) => ({
      id: p.id,
      name: p.name,
      lane: p.lane,
      isYou: p.id === guest.guestId,
    }));

    client.emit(RACE_EVENTS.welcome, {
      matchId,
      youId: guest.guestId,
      seed: record.seed,
      pilots,
      snapshotHz: SNAPSHOT_HZ,
    });

    await this.ensureSimulated(record);
  }

  /**
   * Make sure somebody is ticking this match, and start it on the first arrival.
   *
   * Called on every join rather than at match confirmation, so a race whose owner
   * died is picked up by the next pilot to walk in rather than sitting with
   * motionless bots.
   */
  private async ensureSimulated(record: RaceRecord): Promise<void> {
    const existing = this.owned.get(record.matchId);
    if (existing) {
      existing.start();
      return;
    }
    if (!(await this.races.claim(record.matchId))) return;

    const room = new RaceRoom(record);
    room.start();
    this.owned.set(record.matchId, room);
    this.log.log(
      `simulating race ${record.matchId.slice(0, 8)}: ${room.bots.length} bot pilots`,
    );
  }

  handleDisconnect(client: Socket): void {
    this.seats.delete(client.id);
  }

  // -------------------------------------------------------------------------
  // Flow 1: continuous state, cosmetic, relayed as-is
  // -------------------------------------------------------------------------

  @SubscribeMessage(RACE_EVENTS.pilotState)
  onPilotState(@ConnectedSocket() client: Socket, @MessageBody() msg: PilotState): void {
    const seat = this.seats.get(client.id);
    if (!seat || !msg) return;
    seat.last = msg;

    // Relayed verbatim and never validated: a lie here misdraws the liar's own
    // rocket on other screens and touches nothing else.
    client.to(this.room(seat.matchId)).emit(RACE_EVENTS.snapshot, {
      t: msg.t,
      pilots: { [seat.pilotId]: msg },
    });
  }

  // -------------------------------------------------------------------------
  // Flow 2: discrete events, pushed the instant they arrive
  // -------------------------------------------------------------------------

  @SubscribeMessage(RACE_EVENTS.pilotEvent)
  async onPilotEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() msg: PilotEventMsg,
  ): Promise<void> {
    const seat = this.seats.get(client.id);
    if (!seat || !msg?.kind) return;

    // Broadcast rather than held for the next snapshot. A stall or an ignition
    // reads as instant or reads as broken, with no comfortable middle ground.
    client
      .to(this.room(seat.matchId))
      .emit(RACE_EVENTS.event, { id: seat.pilotId, kind: msg.kind, t: msg.t });

    if (msg.kind !== 'finish') return;

    try {
      const room = this.owned.get(seat.matchId);
      await this.races.recordFinish(seat.matchId, seat.pilotId, {
        wpm: seat.last?.wpm ?? 0,
        accuracy: 100,
        completionMs: room ? room.elapsedMs() : 0,
        progress: 1,
      });
      room?.markFinished(seat.pilotId);
    } catch (err) {
      this.log.error(`could not record finish: ${(err as Error).message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Flow 3: keystroke log, banked for the replay that will do the scoring
  // -------------------------------------------------------------------------

  @SubscribeMessage(RACE_EVENTS.pilotKeys)
  onPilotKeys(@ConnectedSocket() client: Socket, @MessageBody() msg: PilotKeysMsg): void {
    const seat = this.seats.get(client.id);
    if (!seat || !Array.isArray(msg?.keys)) return;
    // Accepted and dropped for now. The replay that turns this into an
    // authoritative WPM is the next piece of work here; collecting the log first
    // means the plumbing is in place when the scoring lands.
  }

  // -------------------------------------------------------------------------
  // Results
  // -------------------------------------------------------------------------

  private async publishResults(matchId: string, room: RaceRoom): Promise<void> {
    const finishes = await this.races.finishes(matchId);
    const rows: ResultRow[] = [];

    for (const pilot of room.record.pilots) {
      const bot = room.bots.find((b) => b.id === pilot.id);
      if (bot) {
        const done = bot.race.phase === 'finished';
        rows.push({
          id: pilot.id,
          name: pilot.name,
          placement: 0,
          wpm: bot.race.wpm,
          accuracy: bot.race.accuracy,
          completionMs: done ? Math.round(bot.wallElapsed * 1000) : null,
          progress: bot.race.progress,
          dnf: !done,
        });
        continue;
      }

      const finish = finishes[pilot.id];
      rows.push({
        id: pilot.id,
        name: pilot.name,
        placement: 0,
        wpm: finish?.wpm ?? 0,
        accuracy: finish?.accuracy ?? 100,
        completionMs: finish?.completionMs ?? null,
        progress: finish?.progress ?? 0,
        dnf: !finish,
      });
    }

    // Finishers by time, then everyone else. A DNF always sorts last: quitting is
    // never a way to avoid a placement. Among DNFs, distance covered breaks the
    // tie, otherwise a pilot who never typed outranks one who stalled out just
    // short of the heliopause.
    rows.sort((a, b) => {
      if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
      if (a.dnf) return b.progress - a.progress;
      return (a.completionMs ?? Infinity) - (b.completionMs ?? Infinity);
    });
    rows.forEach((row, i) => (row.placement = i + 1));

    this.server.to(this.room(matchId)).emit(RACE_EVENTS.results, { matchId, rows });
  }

  private room(matchId: string): string {
    return `race:${matchId}`;
  }
}
