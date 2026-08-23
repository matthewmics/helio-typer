import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, MessageBody, ConnectedSocket, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { Room } from './room';
import { EVENTS } from './shared/protocol';
import type { JoinMsg, PilotEventMsg, PilotKeysMsg, PilotStateMsg, TuneMsg } from './shared/protocol';

/**
 * The whole multiplayer surface: one room, one loop, three inbound flows.
 *
 * The loop runs at a fixed 60Hz for bot physics, but broadcasts at the far lower
 * `net.snapshotHz`. Those two rates being separate is the point: simulation
 * fidelity and network cost are independent choices, and conflating them is how
 * you end up believing you need 60Hz networking.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class LobbyGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger('Lobby');
  private readonly room = new Room();

  private _last = Date.now();
  private _sinceBroadcast = 0;

  afterInit(): void {
    this.room.restart();
    // 120Hz nominal physics tick. Physics accuracy does not need it (every update
    // takes a measured dt rather than assuming a fixed step), but the broadcast
    // rate is quantised to this tick, so a nominal 60Hz loop that really lands
    // near 45Hz cannot deliver a clean 30Hz snapshot stream. Ticking well above
    // the highest selectable snapshot rate keeps the slider honest.
    setInterval(() => this._loop(), 1000 / 120);
    this.log.log('multiplayer playground up, 120Hz sim tick');
  }

  private _loop(): void {
    const now = Date.now();
    const dt = Math.min(0.25, (now - this._last) / 1000);
    this._last = now;

    this.room.tick(dt);

    this._sinceBroadcast += dt;
    const interval = 1 / Math.max(1, this.room.net.snapshotHz);
    if (this._sinceBroadcast >= interval) {
      // Carry the remainder rather than resetting to zero. Zeroing throws away
      // the overshoot on every broadcast, which compounds into a measurably
      // slower rate than the setting asks for, and in a prototype whose whole
      // job is measuring the effect of the snapshot rate, the number on the
      // slider has to be the number on the wire.
      this._sinceBroadcast = Math.min(this._sinceBroadcast - interval, interval);
      this.server.emit(EVENTS.snapshot, this.room.snapshot());
    }
  }

  // -------------------------------------------------------------------------
  // Connection
  // -------------------------------------------------------------------------

  handleConnection(client: Socket): void {
    this.log.log(`connect ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.room.removeHuman(client.id);
    this.room.syncBots();
    this._broadcastLobby();
    this.log.log(`disconnect ${client.id}`);
  }

  @SubscribeMessage(EVENTS.join)
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() msg: JoinMsg): void {
    const wasEmpty = this.room.humans.size === 0;
    this.room.addHuman(client.id, msg?.name?.trim() || 'pilot');
    // First pilot in restarts the race, so they open onto a fresh field rather
    // than whatever the last session left sitting at the finish line. A second
    // tab joining mid-race deliberately does not, since that would yank the race
    // out from under the pilot already flying it.
    if (wasEmpty) this.room.restart();
    else this.room.syncBots();

    client.emit(EVENTS.welcome, {
      playerId: client.id,
      seed: this.room.seed,
      config: this.room.config,
      net: this.room.net,
    });
    this._broadcastLobby();
  }

  private _broadcastLobby(): void {
    // Each client needs its own roster, since `isYou` differs per recipient.
    for (const [id, sock] of this.server.sockets.sockets) {
      sock.emit(EVENTS.lobby, { pilots: this.room.roster(id) });
    }
  }

  // -------------------------------------------------------------------------
  // Flow 1: continuous state, cosmetic, relayed as-is
  // -------------------------------------------------------------------------

  @SubscribeMessage(EVENTS.pilotState)
  onPilotState(@ConnectedSocket() client: Socket, @MessageBody() msg: PilotStateMsg): void {
    const pilot = this.room.humans.get(client.id);
    if (!pilot) return;
    // Stored verbatim and never validated. If a client lies here, its own rocket
    // renders wrong on other screens and nothing else in the system notices,
    // which is the intended blast radius for a cosmetic channel.
    pilot.state = msg;
    if (msg.phase === 'finished' && pilot.finishedAt === null) {
      pilot.finishedAt = Date.now();
    }
  }

  // -------------------------------------------------------------------------
  // Flow 2: discrete events, relayed the instant they arrive
  // -------------------------------------------------------------------------

  @SubscribeMessage(EVENTS.pilotEvent)
  onPilotEvent(@ConnectedSocket() client: Socket, @MessageBody() msg: PilotEventMsg): void {
    if (!this.room.humans.has(client.id)) return;
    // Broadcast rather than queued for the next snapshot. A stall or an ignition
    // reads as instant or reads as broken, there is no comfortable middle ground
    // the way there is for continuous position.
    client.broadcast.emit(EVENTS.relayEvent, { id: client.id, kind: msg.kind, t: msg.t });
  }

  // -------------------------------------------------------------------------
  // Flow 3: keystroke log, the only thing that feeds a result
  // -------------------------------------------------------------------------

  @SubscribeMessage(EVENTS.pilotKeys)
  onPilotKeys(@ConnectedSocket() client: Socket, @MessageBody() msg: PilotKeysMsg): void {
    const pilot = this.room.humans.get(client.id);
    if (!pilot || !Array.isArray(msg?.keys)) return;
    // Append-only. Arrives batched and asynchronous, so it never sat in the path
    // of a keystroke being rendered.
    pilot.keys.push(...msg.keys);
  }

  // -------------------------------------------------------------------------
  // Dev tuning
  // -------------------------------------------------------------------------

  @SubscribeMessage(EVENTS.tune)
  onTune(@MessageBody() msg: TuneMsg): void {
    if (msg.config) Object.assign(this.room.config, msg.config);
    if (msg.net) Object.assign(this.room.net, msg.net);
    if (msg.bots) {
      Object.assign(this.room.botCfg, msg.bots);
      this.room.syncBots();
      this._broadcastLobby();
    }
  }

  @SubscribeMessage(EVENTS.restart)
  onRestart(): void {
    const rows = this.room.results();
    this.server.emit(EVENTS.results, { rows });
    this.room.restart();
    this._broadcastLobby();
    this.server.emit(EVENTS.start, { seed: this.room.seed, t: Date.now() });
  }
}
