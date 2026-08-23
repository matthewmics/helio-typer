import { io, type Socket } from 'socket.io-client';
import { DEFAULT_NET, type NetConfig } from './shared/config';
import { EVENTS } from './shared/protocol';
import type {
  KeyEvent,
  LobbyMsg,
  PilotEventKind,
  PilotInfo,
  PilotStateMsg,
  RelayEventMsg,
  ResultsMsg,
  SnapshotMsg,
  TuneMsg,
  WelcomeMsg,
} from './shared/protocol';

/** One remote pilot's snapshot history, kept long enough to interpolate through. */
interface Track {
  info: PilotInfo;
  buffer: PilotStateMsg[];
  /** Set by discrete events, which arrive out of band from the snapshot stream. */
  flash: { kind: PilotEventKind; at: number } | null;
}

/**
 * The client's whole view of the network, including the two things that make this
 * prototype worth running: a simulated link, and snapshot interpolation.
 *
 * Everything here is deliberately separate from the game's own simulation. The
 * local pilot never consults this class to decide whether a keystroke was correct,
 * which is the entire premise of section 4.9. This only handles what other pilots
 * are doing.
 */
export class Net {
  private _sock: Socket;
  net: NetConfig = { ...DEFAULT_NET };

  playerId = '';
  seed = 0;
  tracks = new Map<string, Track>();
  results: ResultsMsg | null = null;

  /** Rolling estimate of one-way delay, shown in the panel as a sanity check. */
  pingMs = 0;

  private _keyQueue: KeyEvent[] = [];
  private _sinceSend = 0;
  private _sinceKeys = 0;

  onLobby?: (pilots: PilotInfo[]) => void;
  onResults?: (r: ResultsMsg) => void;
  onStart?: (seed: number) => void;

  constructor(url: string, name: string) {
    this._sock = io(url, { transports: ['websocket'] });

    this._sock.on('connect', () => this._sock.emit(EVENTS.join, { name }));

    this._sock.on(EVENTS.welcome, (m: WelcomeMsg) => {
      this.playerId = m.playerId;
      this.seed = m.seed;
      Object.assign(this.net, m.net);
    });

    this._sock.on(EVENTS.lobby, (m: LobbyMsg) => {
      const seen = new Set<string>();
      for (const p of m.pilots) {
        seen.add(p.id);
        const t = this.tracks.get(p.id);
        if (t) t.info = p;
        else this.tracks.set(p.id, { info: p, buffer: [], flash: null });
      }
      for (const id of [...this.tracks.keys()]) if (!seen.has(id)) this.tracks.delete(id);
      this.onLobby?.(m.pilots);
    });

    // Inbound messages go through the same simulated link as outbound, so a
    // configured 60ms latency is 60ms each way, matching how a real link behaves.
    this._sock.on(EVENTS.snapshot, (m: SnapshotMsg) => this._delayed(() => this._onSnapshot(m)));
    this._sock.on(EVENTS.relayEvent, (m: RelayEventMsg) => this._delayed(() => this._onEvent(m)));
    this._sock.on(EVENTS.results, (m: ResultsMsg) => this._delayed(() => {
      this.results = m;
      this.onResults?.(m);
    }));
    this._sock.on(EVENTS.start, (m: { seed: number }) => this._delayed(() => {
      this.results = null;
      this.seed = m.seed;
      this.onStart?.(m.seed);
    }));
  }

  // -------------------------------------------------------------------------
  // Simulated link
  // -------------------------------------------------------------------------

  /**
   * Hold a message for the configured latency, jitter it, and sometimes drop it.
   *
   * A real prototype on localhost has a sub-millisecond link, which is exactly the
   * condition under which every netcode bug hides. Being able to dial in 150ms and
   * 5% loss from the panel is the difference between "it looks fine" and knowing
   * whether it actually is.
   */
  private _delayed(fn: () => void): void {
    if (this.net.packetLoss > 0 && Math.random() < this.net.packetLoss) return;
    const jitter = (Math.random() * 2 - 1) * this.net.jitterMs;
    const d = Math.max(0, this.net.latencyMs + jitter);
    this.pingMs = this.pingMs * 0.9 + d * 0.1;
    if (d === 0) fn();
    else setTimeout(fn, d);
  }

  private _emit(event: string, payload: unknown): void {
    this._delayed(() => this._sock.emit(event, payload));
  }

  // -------------------------------------------------------------------------
  // Inbound
  // -------------------------------------------------------------------------

  private _onSnapshot(m: SnapshotMsg): void {
    for (const [id, state] of Object.entries(m.pilots)) {
      const track = this.tracks.get(id);
      if (!track || id === this.playerId) continue;
      track.buffer.push({ ...state, t: m.t });
      // Two seconds of history is far more than interpolation needs and cheap to
      // hold; it just has to not grow without bound.
      const cutoff = m.t - 2000;
      while (track.buffer.length > 2 && track.buffer[0].t < cutoff) track.buffer.shift();
    }
  }

  private _onEvent(m: RelayEventMsg): void {
    const track = this.tracks.get(m.id);
    if (track) track.flash = { kind: m.kind, at: performance.now() };
  }

  // -------------------------------------------------------------------------
  // Outbound
  // -------------------------------------------------------------------------

  /** Flow 2: pushed the instant it happens, never waits for the send tick. */
  sendEvent(kind: PilotEventKind): void {
    this._emit(EVENTS.pilotEvent, { kind, t: Date.now() });
  }

  /** Flow 3: queued locally, flushed on a slow timer, never blocking input. */
  queueKey(k: KeyEvent): void {
    this._keyQueue.push(k);
  }

  /**
   * Called every frame. Handles the two rate-limited outbound flows.
   *
   * Note what is NOT here: nothing about a keystroke's correctness waits on this.
   * The local `Race` has already resolved and rendered the keypress by the time it
   * shows up in the queue.
   */
  update(dt: number, state: () => PilotStateMsg): void {
    this._sinceSend += dt;
    const interval = 1 / Math.max(1, this.net.clientSendHz);
    if (this._sinceSend >= interval) {
      this._sinceSend = 0;
      this._emit(EVENTS.pilotState, state());
    }

    // Keystroke log flushes far slower than state, because nothing is waiting on
    // it. Every 400ms is plenty for something only read at race end.
    this._sinceKeys += dt;
    if (this._sinceKeys >= 0.4) {
      this._sinceKeys = 0;
      if (this._keyQueue.length) {
        this._emit(EVENTS.pilotKeys, { keys: this._keyQueue });
        this._keyQueue = [];
      }
    }
  }

  tune(msg: TuneMsg): void {
    if (msg.net) Object.assign(this.net, msg.net);
    this._emit(EVENTS.tune, msg);
  }

  restart(): void {
    this._emit(EVENTS.restart, {});
  }

  // -------------------------------------------------------------------------
  // Interpolation
  // -------------------------------------------------------------------------

  /**
   * Where a remote pilot should be drawn right now.
   *
   * Renders `interpDelayMs` in the past and blends the two snapshots bracketing
   * that instant. Rendering behind the newest data is not a bug being worked
   * around, it is the price of smoothness: you cannot interpolate toward a
   * position you have not received yet, so you either lag slightly and glide, or
   * stay current and snap.
   *
   * With `interpolate` off this returns the newest snapshot verbatim, which is
   * what makes the difference visible at a glance.
   */
  sample(id: string, now: number): PilotStateMsg | null {
    const track = this.tracks.get(id);
    if (!track || track.buffer.length === 0) return null;

    const buf = track.buffer;
    if (!this.net.interpolate) return buf[buf.length - 1];

    const target = now - this.net.interpDelayMs;

    // Newer than anything buffered: hold the latest rather than extrapolating.
    // Guessing ahead of the data is how remote ships end up overshooting and
    // snapping back, which reads worse than a few ms of lag.
    if (target >= buf[buf.length - 1].t) return buf[buf.length - 1];
    if (target <= buf[0].t) return buf[0];

    for (let i = 0; i < buf.length - 1; i++) {
      const a = buf[i];
      const b = buf[i + 1];
      if (target >= a.t && target <= b.t) {
        const span = b.t - a.t;
        const f = span > 0 ? (target - a.t) / span : 0;
        return {
          ...b,
          // Only the continuous quantities are blended. Phase, hull and tier are
          // discrete states, and averaging them would invent values that never
          // existed (a hull of 3.5, a phase halfway between racing and stalled).
          progress: a.progress + (b.progress - a.progress) * f,
          speed: a.speed + (b.speed - a.speed) * f,
          wpm: a.wpm,
          phase: a.phase,
          hull: a.hull,
          tier: a.tier,
        };
      }
    }
    return buf[buf.length - 1];
  }

  /** Buffered snapshot count for a pilot, surfaced in the panel as a health read. */
  bufferDepth(id: string): number {
    return this.tracks.get(id)?.buffer.length ?? 0;
  }
}
