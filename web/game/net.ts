import type { Phase, RocketId } from '@heliotyper/engine';
import type { PilotView } from './pilot';

/** One pilot's state as it travels. Mirrors `api/src/race/race.protocol.ts`. */
export interface PilotStateWire {
  t: number;
  progress: number;
  speed: number;
  speedRatio: number;
  tier: number;
  hull: number;
  phase: Phase;
  launched: boolean;
  launchT: number;
  wpm: number;
  stallTimer: number;
  /** Wrong keys so far, for the standings. */
  mistakes: number;
}

export type PilotEventKind = 'launch' | 'mistake' | 'breach' | 'recover' | 'finish';

export interface RacePilotInfo {
  id: string;
  name: string;
  lane: number;
  /** The rocket to draw them as, decided by the server so every screen agrees. */
  ship: RocketId;
  isYou: boolean;
}

/** A finish the server has banked. Its time is the official one placings go by. */
export interface PilotFinish {
  completionMs: number;
  wpm: number;
  mistakes: number;
}

/** What the scene needs from the network. Kept narrow so a solo race can pass null. */
export interface RaceNetClient {
  youId: string;
  pilots: RacePilotInfo[];
  /** Buffered remote state, played back interpolated. */
  field: RemoteField;
  /**
   * When the race starts, on this browser's clock, or null while the server is
   * still waiting for pilots to connect. Keys do nothing before it.
   *
   * This and the fields below are updated in place as the server reports in,
   * so whoever needs them reads them when they need them.
   */
  startAt: number | null;
  /** Humans connected, out of `humans`. Bots are never waited for. */
  joined: number;
  humans: number;
  /** Banked finishes by pilot id. */
  finishes: Map<string, PilotFinish>;
  sendState(state: PilotStateWire): void;
  sendEvent(kind: PilotEventKind): void;
  onEvent(handler: (pilotId: string, kind: PilotEventKind) => void): void;
}

/**
 * The remote half of the field: buffered snapshots, played back interpolated.
 *
 * This is the single most load-bearing piece of the netcode. Snapshots arrive
 * about twelve times a second; drawing each one the moment it lands makes every
 * other rocket teleport a dozen times a second. Interpolating between the last
 * two makes them glide, and the snapshot rate then barely matters. Turning this
 * off at 30Hz looks worse than leaving it on at 12Hz.
 *
 * Playback runs `delayMs` behind the newest sample on purpose. Interpolation
 * needs two samples to sit between, so it has to render slightly in the past.
 * Too little and it runs out of buffer and stutters; too much and rockets
 * visibly lag where they really are. Rendering in the past is the price of
 * smoothness, not a bug.
 */
export class RemoteField {
  private readonly _buffers = new Map<string, PilotStateWire[]>();
  private readonly _delayMs: number;

  constructor(snapshotHz: number) {
    // Roughly 1.5 snapshot intervals, the usual starting point.
    this._delayMs = (1000 / Math.max(1, snapshotHz)) * 1.5;
  }

  /**
   * Take a partial snapshot.
   *
   * Sender timestamps are deliberately discarded in favour of arrival time.
   * Every sample here comes from a different machine, and mixing several
   * unsynchronised clocks into one timeline puts rockets in the wrong place far
   * more often than the jitter smoothing would win back. One local clock is
   * simpler and, across the field, more accurate.
   */
  ingest(pilots: Record<string, PilotStateWire>): void {
    const now = performance.now();
    for (const [id, state] of Object.entries(pilots)) {
      let buffer = this._buffers.get(id);
      if (!buffer) {
        buffer = [];
        this._buffers.set(id, buffer);
      }
      buffer.push({ ...state, t: now });
      // Two samples is the minimum to interpolate between. Anything older than
      // the playback window is dead weight.
      while (buffer.length > 2 && now - buffer[1].t > this._delayMs * 3) buffer.shift();
    }
  }

  /**
   * The newest sample as it arrived, uninterpolated, or null if nothing has.
   * For readouts like the standings, which want the latest count, not a
   * position smoothed into the past.
   */
  latest(id: string): PilotStateWire | null {
    const buffer = this._buffers.get(id);
    return buffer && buffer.length > 0 ? buffer[buffer.length - 1] : null;
  }

  /** The pilot as they should be drawn right now, or null if nothing has arrived. */
  view(id: string, maxHull: number): PilotView | null {
    const buffer = this._buffers.get(id);
    if (!buffer || buffer.length === 0) return null;

    const target = performance.now() - this._delayMs;

    if (buffer.length === 1 || target <= buffer[0].t) return toView(buffer[0], maxHull);

    for (let i = buffer.length - 1; i > 0; i--) {
      const b = buffer[i];
      const a = buffer[i - 1];
      if (target >= a.t && target <= b.t) {
        const span = b.t - a.t;
        const k = span > 0 ? (target - a.t) / span : 1;
        return toView({ ...b, progress: a.progress + (b.progress - a.progress) * k, speed: a.speed + (b.speed - a.speed) * k }, maxHull);
      }
    }

    // Ran out of buffered future. Holding the newest sample is what a stutter
    // looks like, and is the correct fallback: inventing motion past the last
    // known position would have to be undone the moment the next one lands.
    return toView(buffer[buffer.length - 1], maxHull);
  }
}

function toView(state: PilotStateWire, maxHull: number): PilotView {
  return {
    launched: state.launched,
    launchT: state.launchT,
    speed: state.speed,
    speedRatio: state.speedRatio,
    tier: state.tier,
    phase: state.phase,
    hull: state.hull,
    maxHull,
    progress: state.progress,
  };
}
