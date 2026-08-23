import { Actor, Canvas, Color, Engine, Scene, vec } from 'excalibur';
import { RocketActor, type RocketView } from '../actors/RocketActor';
import { Race } from '../shared/race';
import { MAX_PLAYERS } from '../shared/config';
import type { Net } from '../net';
import type { PilotInfo } from '../shared/protocol';

const W = 1280;
const H = 720;
const TRACK_TOP = 130;
const TRACK_BOTTOM = 600;

/**
 * The race view: six lanes, one rocket each, the local pilot simulated here and
 * everyone else reconstructed from the snapshot stream.
 *
 * The asymmetry is the whole demonstration. `this.race` is a real simulation
 * running on real keystrokes with zero network in the path. Every other rocket is
 * a reconstruction from data that is, by the time it is drawn, already at least
 * `latency + interpDelay` milliseconds old. Both are on screen at once, which
 * makes it obvious what each approach costs.
 */
export class RaceScene extends Scene {
  private _net: Net;
  private _race: Race;
  private _rockets = new Map<string, RocketActor>();
  private _flashes = new Map<string, { t: number; kind: string }>();
  private _onPrompt: () => void;

  constructor(net: Net, race: Race, onPrompt: () => void) {
    super();
    this._net = net;
    this._race = race;
    this._onPrompt = onPrompt;
  }

  override onInitialize(engine: Engine): void {
    const bg = new Actor({ pos: vec(W / 2, H / 2), anchor: vec(0.5, 0.5), z: -100 });
    bg.graphics.use(
      new Canvas({
        width: W,
        height: H,
        cache: true,
        draw: (ctx) => this._drawBackdrop(ctx),
      }),
    );
    engine.add(bg);

    this._net.onLobby = (pilots) => this._rebuild(engine, pilots);
  }

  private _drawBackdrop(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#05060a');
    grad.addColorStop(0.6, '#0b1024');
    grad.addColorStop(1, '#161d45');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 260; i++) {
      const r = Math.random() * 1.4 + 0.3;
      ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.5 + 0.1).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Finish line: the heliopause as a band rather than a disc, per the design
    // note that the finish must read as a different kind of object than the
    // landmarks passed on the way there.
    const band = ctx.createLinearGradient(0, TRACK_TOP - 40, 0, TRACK_TOP + 16);
    band.addColorStop(0, 'rgba(79,216,255,0)');
    band.addColorStop(0.55, 'rgba(79,216,255,0.42)');
    band.addColorStop(1, 'rgba(166,120,255,0.14)');
    ctx.fillStyle = band;
    ctx.fillRect(0, TRACK_TOP - 40, W, 56);

    ctx.strokeStyle = 'rgba(79,216,255,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, TRACK_TOP);
    ctx.lineTo(W, TRACK_TOP);
    ctx.stroke();

    ctx.font = '600 11px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(79,216,255,0.85)';
    ctx.textAlign = 'left';
    ctx.fillText('THE HELIOPAUSE', 16, TRACK_TOP - 12);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < MAX_PLAYERS; i++) {
      const x = (W / MAX_PLAYERS) * i;
      ctx.beginPath();
      ctx.moveTo(x, TRACK_TOP);
      ctx.lineTo(x, TRACK_BOTTOM + 40);
      ctx.stroke();
    }
  }

  private _rebuild(engine: Engine, pilots: PilotInfo[]): void {
    for (const [id, actor] of this._rockets) {
      if (!pilots.find((p) => p.id === id)) {
        engine.remove(actor);
        this._rockets.delete(id);
      }
    }

    const laneW = W / MAX_PLAYERS;
    for (const p of pilots) {
      if (this._rockets.has(p.id)) continue;
      const view: RocketView = {
        name: p.name,
        progress: 0,
        speed: 0,
        tier: 0,
        hull: this._race.cfg.maxHull,
        maxHull: this._race.cfg.maxHull,
        phase: 'racing',
        wpm: 0,
        isYou: p.isYou,
        isBot: p.isBot,
        flash: 99,
        flashKind: null,
      };
      const actor = new RocketActor(p.lane, laneW, TRACK_TOP, TRACK_BOTTOM, view);
      this._rockets.set(p.id, actor);
      engine.add(actor);
    }
  }

  /** Record a discrete event for a remote pilot so its one-shot flash can fire. */
  flash(id: string, kind: string): void {
    this._flashes.set(id, { t: 0, kind });
  }

  override onPreUpdate(_engine: Engine, elapsed: number): void {
    const dt = elapsed / 1000;
    const now = Date.now();

    for (const f of this._flashes.values()) f.t += dt;

    for (const [id, actor] of this._rockets) {
      const v = actor.view;
      const flash = this._flashes.get(id);
      v.flash = flash ? flash.t : 99;
      v.flashKind = flash ? flash.kind : null;
      v.maxHull = this._race.cfg.maxHull;

      if (id === this._net.playerId) {
        // Local pilot: read straight off the simulation that the keyboard drives.
        // No interpolation, no buffer, no delay. This is the reference the remote
        // rockets are being compared against.
        v.progress = this._race.progress;
        v.speed = this._race.speed;
        v.tier = this._race.tier;
        v.hull = this._race.hull;
        v.phase = this._race.phase;
        v.wpm = this._race.wpm;
        continue;
      }

      // Everyone else: reconstructed from buffered snapshots.
      const s = this._net.sample(id, now);
      if (!s) continue;
      v.progress = s.progress;
      v.speed = s.speed;
      v.tier = s.tier;
      v.hull = s.hull;
      v.phase = s.phase;
      v.wpm = s.wpm;
    }
  }

  get race(): Race {
    return this._race;
  }

  get onPromptChanged(): () => void {
    return this._onPrompt;
  }

  static get bg(): Color {
    return Color.fromHex('#05060a');
  }
}
