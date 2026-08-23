import { Actor, Canvas, Color, vec } from 'excalibur';
import type { Phase } from '../shared/race';

export interface RocketView {
  name: string;
  progress: number;
  speed: number;
  tier: number;
  hull: number;
  maxHull: number;
  phase: Phase;
  wpm: number;
  isYou: boolean;
  isBot: boolean;
  /** Seconds since a discrete event landed, for the one-shot flashes. */
  flash: number;
  flashKind: string | null;
}

const LANE_COLORS = ['#4fd8ff', '#ffb84d', '#4dffb4', '#a678ff', '#ff8a4d', '#ff4d84'];

/**
 * One rocket in a lane, drawn with primitives rather than the generated art.
 *
 * The real game's art lives in assets/ and is the whole reason the single player
 * port looks the way it does. None of it is here on purpose: this prototype is
 * asking "can you read six pilots' relative position, speed and state at a
 * glance", and shapes answer that question without a 1.5MB heliopause sprite or a
 * dependency on the repo's asset pipeline inside a container.
 */
export class RocketActor extends Actor {
  view: RocketView;
  private _lane: number;
  private _laneW: number;
  private _trackTop: number;
  private _trackBottom: number;

  constructor(lane: number, laneW: number, trackTop: number, trackBottom: number, view: RocketView) {
    super({ pos: vec(0, 0), anchor: vec(0.5, 0.5), width: laneW, height: 200 });
    this._lane = lane;
    this._laneW = laneW;
    this._trackTop = trackTop;
    this._trackBottom = trackBottom;
    this.view = view;

    const canvas = new Canvas({
      width: laneW,
      height: 240,
      cache: false,
      draw: (ctx) => this._draw(ctx),
    });
    this.graphics.use(canvas);
  }

  override onPreUpdate(): void {
    const v = this.view;
    const x = this._lane * this._laneW + this._laneW / 2;
    // Progress drives screen y directly. In the real game the camera is locked and
    // the ship interpolates toward landmarks; here a straight lane read is more
    // useful, because the question is relative standing, not scenery.
    const y = this._trackBottom - v.progress * (this._trackBottom - this._trackTop);
    this.pos = vec(x, y);
  }

  private _draw(ctx: CanvasRenderingContext2D): void {
    const v = this.view;
    const w = this._laneW;
    const cx = w / 2;
    const cy = 150;
    const color = LANE_COLORS[this._lane % LANE_COLORS.length];
    const stalled = v.phase === 'stalled';

    ctx.clearRect(0, 0, w, 240);

    // Exhaust plume. Length tracks speed, so a pilot who stopped typing visibly
    // loses their flame well before their position falls behind, which is the
    // main thing that makes the decay mechanic legible from across the screen.
    if (!stalled && v.speed > 0.01) {
      const len = 14 + v.tier * 16;
      const flicker = 0.85 + Math.random() * 0.15;
      const grad = ctx.createLinearGradient(cx, cy + 26, cx, cy + 26 + len * flicker);
      grad.addColorStop(0, 'rgba(255,240,180,0.95)');
      grad.addColorStop(0.4, `${color}cc`);
      grad.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy + 26);
      ctx.lineTo(cx + 7, cy + 26);
      ctx.lineTo(cx + 2, cy + 26 + len * flicker);
      ctx.lineTo(cx - 2, cy + 26 + len * flicker);
      ctx.closePath();
      ctx.fill();
    }

    // Hull body
    ctx.fillStyle = stalled ? '#4a4f68' : '#e6e9f7';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 30);
    ctx.quadraticCurveTo(cx + 13, cy - 8, cx + 13, cy + 16);
    ctx.lineTo(cx + 13, cy + 26);
    ctx.lineTo(cx - 13, cy + 26);
    ctx.lineTo(cx - 13, cy + 16);
    ctx.quadraticCurveTo(cx - 13, cy - 8, cx, cy - 30);
    ctx.closePath();
    ctx.fill();

    // Fins in the lane colour, which is how you tell pilots apart at a distance.
    ctx.fillStyle = stalled ? '#33384d' : color;
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy + 10);
    ctx.lineTo(cx - 23, cy + 30);
    ctx.lineTo(cx - 13, cy + 26);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 13, cy + 10);
    ctx.lineTo(cx + 23, cy + 30);
    ctx.lineTo(cx + 13, cy + 26);
    ctx.closePath();
    ctx.fill();

    // Window
    ctx.fillStyle = stalled ? '#1a1d2b' : '#131832';
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 6, 0, Math.PI * 2);
    ctx.fill();
    if (!stalled) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stall arcs: the one state that has to read instantly from a glance, since
    // it is the only thing that fully stops a pilot.
    if (stalled) {
      ctx.strokeStyle = `rgba(255,77,132,${0.4 + Math.random() * 0.5})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 30 + i * 5, a, a + 0.7 + Math.random() * 0.6);
        ctx.stroke();
      }
    }

    // Event flash. Driven by the discrete event stream, not the snapshot stream,
    // so it fires on arrival rather than on the next scheduled position update.
    if (v.flash > 0) {
      const alpha = Math.max(0, 1 - v.flash / 0.45);
      if (v.flashKind === 'breach' || v.flashKind === 'mistake') {
        ctx.strokeStyle = `rgba(255,77,132,${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 34 + (1 - alpha) * 26, 0, Math.PI * 2);
        ctx.stroke();
      } else if (v.flashKind === 'launch') {
        ctx.fillStyle = `rgba(255,220,140,${alpha * 0.85})`;
        ctx.beginPath();
        ctx.arc(cx, cy + 30, 16 + (1 - alpha) * 30, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Name tag
    ctx.font = `${v.isYou ? '700 ' : ''}11px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = v.isYou ? '#ffffff' : 'rgba(230,233,247,0.62)';
    const label = v.isBot ? `${v.name} *` : v.name;
    ctx.fillText(v.isYou ? `${label} (you)` : label, cx, cy - 44);

    // Hull pips
    const pipW = 6;
    const total = v.maxHull * (pipW + 3) - 3;
    for (let i = 0; i < v.maxHull; i++) {
      ctx.fillStyle = i < v.hull ? color : 'rgba(255,255,255,0.14)';
      ctx.fillRect(cx - total / 2 + i * (pipW + 3), cy - 38, pipW, 3);
    }

    // WPM readout
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(130,140,181,0.9)';
    ctx.fillText(`${v.wpm} wpm`, cx, cy + 48);
  }

  static laneColor(lane: number): Color {
    return Color.fromHex(LANE_COLORS[lane % LANE_COLORS.length]);
  }
}
