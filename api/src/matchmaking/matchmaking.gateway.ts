import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { GuestService, INSTANCE_ID, type Guest } from './guest.service';
import { MatchmakingService, type MatchRecord } from './matchmaking.service';
import { MM_EVENTS, type ReadyDecisionMsg } from './matchmaking.protocol';
import { QUEUE_TICK_MS, SWEEP_TICK_MS } from './matchmaking.config';

/**
 * The guest-facing matchmaking surface.
 *
 * Two rules govern every emit in this file, and mixing them up is the way a
 * clustered socket app goes wrong:
 *
 *   - **Match events go out cluster-wide**, via `server.to(socketId)`, which the
 *     Redis adapter relays because every socket is in a room named after its own
 *     id. This is correct precisely because exactly one instance ever holds a
 *     given match event: the Lua scripts hand a formed match, a decision, or an
 *     expiry to a single caller, so a cluster-wide emit fires exactly once.
 *
 *   - **The periodic queue status goes out locally**, to this instance's own
 *     sockets only. Every instance runs the same timer, so a cluster-wide emit
 *     here would deliver one copy per instance. Each socket is owned by exactly
 *     one process, so "everyone tells their own sockets" covers everybody once,
 *     with no coordination at all.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class MatchmakingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer() server!: Server;
  private readonly log = new Logger('Matchmaking');

  /**
   * Guests attached to sockets on this instance only.
   *
   * Local cache of local facts, not shared state: it saves a Redis round trip on
   * every message from a socket this process already owns, and losing it on a
   * restart costs nothing because the sockets die with the process anyway.
   */
  private readonly local = new Map<string, Guest>();

  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly guests: GuestService,
    private readonly mm: MatchmakingService,
  ) {}

  afterInit(): void {
    // Every instance ticks. The scripts are atomic, so concurrent ticks race
    // harmlessly: at most one of them forms any given match, and the rest get
    // null back. Leader election here would add a failure mode without removing
    // any work.
    this.timers.push(setInterval(() => void this.tick(), QUEUE_TICK_MS));
    this.timers.push(setInterval(() => void this.sweep(), SWEEP_TICK_MS));
    this.log.log(`matchmaking up on ${INSTANCE_ID}`);
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  async handleConnection(client: Socket): Promise<void> {
    const auth = client.handshake.auth as { guestId?: string; token?: string };
    const { guest, resumeToken } = await this.guests.identify(client.id, auth);
    this.local.set(client.id, guest);

    client.emit(MM_EVENTS.guestIdentity, {
      guestId: guest.guestId,
      name: guest.name,
      resumeToken,
    });
    client.emit(MM_EVENTS.queueStatus, await this.mm.queueStatus(guest.guestId));
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const guest = this.local.get(client.id);
    this.local.delete(client.id);
    if (!guest) return;

    await this.guests.detach(client.id);
    await this.mm.dequeue(guest.guestId);

    // A pilot who vanishes mid-ready-check is a decline. Waiting out their timer
    // would hold five other people on a prompt for someone whose browser is
    // already closed.
    const matchId = await this.guests.currentMatch(guest.guestId);
    if (matchId) {
      const res = await this.mm.decide(matchId, guest.guestId, 'decline');
      if (res.outcome === 'failed' && res.match) this.announceFailure(res.match);
    }
  }

  // -------------------------------------------------------------------------
  // Client messages
  // -------------------------------------------------------------------------

  @SubscribeMessage(MM_EVENTS.queueJoin)
  async onQueueJoin(@ConnectedSocket() client: Socket): Promise<void> {
    const guest = this.local.get(client.id);
    if (!guest) return;
    await this.mm.enqueue(guest.guestId);
    client.emit(MM_EVENTS.queueStatus, await this.mm.queueStatus(guest.guestId));
  }

  @SubscribeMessage(MM_EVENTS.queueLeave)
  async onQueueLeave(@ConnectedSocket() client: Socket): Promise<void> {
    const guest = this.local.get(client.id);
    if (!guest) return;
    await this.mm.dequeue(guest.guestId);
    client.emit(MM_EVENTS.queueStatus, await this.mm.queueStatus(guest.guestId));
  }

  @SubscribeMessage(MM_EVENTS.readyAccept)
  async onAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() msg: ReadyDecisionMsg,
  ): Promise<void> {
    await this.decide(client, msg, 'accept');
  }

  @SubscribeMessage(MM_EVENTS.readyDecline)
  async onDecline(
    @ConnectedSocket() client: Socket,
    @MessageBody() msg: ReadyDecisionMsg,
  ): Promise<void> {
    await this.decide(client, msg, 'decline');
  }

  private async decide(
    client: Socket,
    msg: ReadyDecisionMsg,
    action: 'accept' | 'decline',
  ): Promise<void> {
    const guest = this.local.get(client.id);
    if (!guest || !msg?.matchId) return;

    const res = await this.mm.decide(msg.matchId, guest.guestId, action);
    if (!res.match) return;

    switch (res.outcome) {
      case 'accepted':
        this.announceProgress(res.match);
        break;
      case 'confirmed':
        await this.announceConfirmed(res.match);
        break;
      case 'failed':
        this.announceFailure(res.match);
        break;
      default:
        // gone, closed, not_in_match: the match resolved without this pilot, and
        // they will already have been told how. Nothing useful to say twice.
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Timers
  // -------------------------------------------------------------------------

  private async tick(): Promise<void> {
    try {
      // Drain rather than forming one match per tick, so a burst of arrivals is
      // not metered out at one lobby per second.
      for (;;) {
        const match = await this.mm.tryFormMatch();
        if (!match) break;
        this.announceFound(match);
        const bots = match.players.filter((p) => p.bot).length;
        this.log.log(
          `match ${match.id.slice(0, 8)} formed: ${match.players.length - bots} guests, ${bots} bots`,
        );
      }
      await this.pushLocalQueueStatus();
    } catch (err) {
      this.log.error(`tick failed: ${(err as Error).message}`);
    }
  }

  private async sweep(): Promise<void> {
    try {
      for (const match of await this.mm.sweepExpired()) {
        this.announceFailure(match);
        this.log.log(`match ${match.id.slice(0, 8)} timed out`);
      }
    } catch (err) {
      this.log.error(`sweep failed: ${(err as Error).message}`);
    }
  }

  /** Refresh the wait counter on this instance's own queued sockets. See the class note. */
  private async pushLocalQueueStatus(): Promise<void> {
    for (const [socketId, guest] of this.local) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) continue;
      const status = await this.mm.queueStatus(guest.guestId);
      if (status.state === 'queued') socket.emit(MM_EVENTS.queueStatus, status);
    }
  }

  // -------------------------------------------------------------------------
  // Announcements
  // -------------------------------------------------------------------------

  private announceFound(match: MatchRecord): void {
    const pilots = MatchmakingService.publicPilots(match);
    const accepted = MatchmakingService.acceptedCount(match);
    for (const p of match.players) {
      if (p.bot || !p.socketId) continue;
      this.server.to(p.socketId).emit(MM_EVENTS.matchFound, {
        matchId: match.id,
        deadline: match.deadline,
        now: Date.now(),
        total: match.players.length,
        accepted,
        pilots,
      });
    }
  }

  private announceProgress(match: MatchRecord): void {
    const payload = {
      matchId: match.id,
      accepted: MatchmakingService.acceptedCount(match),
      total: match.players.length,
      pilots: MatchmakingService.publicPilots(match),
    };
    for (const p of match.players) {
      if (p.bot || !p.socketId) continue;
      this.server.to(p.socketId).emit(MM_EVENTS.matchProgress, payload);
    }
  }

  private async announceConfirmed(match: MatchRecord): Promise<void> {
    const socketIds = match.players.filter((p) => !p.bot && p.socketId).map((p) => p.socketId);

    // Park everyone in a room named for the match, so the race gateway can
    // address the lobby as one room instead of rebuilding the roster from Redis
    // on every broadcast.
    if (socketIds.length) {
      await this.server.in(socketIds).socketsJoin(this.raceRoom(match.id));
    }

    const payload = {
      matchId: match.id,
      seed: match.seed,
      pilots: MatchmakingService.publicPilots(match),
    };

    // Deliberately per socket, not `to(raceRoom)`, even though the room was just
    // created above.
    //
    // Under the Redis adapter `socketsJoin` does not apply the join locally and
    // then replicate it. It publishes a request and every instance, including
    // this one, acts on it when the message comes back around through pub/sub.
    // The await returns once the request is published, not once anyone has
    // joined, so a broadcast on the next line races the round trip and lands in
    // an empty room. That is not a hypothetical: it silently swallowed every
    // confirmation until a two-guest run caught it. The room is groundwork for
    // the race gateway, which will broadcast long after the join has settled.
    for (const socketId of socketIds) {
      this.server.to(socketId).emit(MM_EVENTS.matchConfirmed, payload);
    }
    this.log.log(`match ${match.id.slice(0, 8)} confirmed, seed ${match.seed}`);
  }

  private announceFailure(match: MatchRecord): void {
    for (const p of match.players) {
      if (p.bot || !p.socketId) continue;
      this.server.to(p.socketId).emit(MM_EVENTS.matchFailed, {
        matchId: match.id,
        reason: match.reason ?? 'timeout',
        requeued: p.requeued === true,
      });
    }
  }

  private raceRoom(matchId: string): string {
    return `race:${matchId}`;
  }
}
