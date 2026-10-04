import { type Atlas, type Clip, drawSprite, frameAt, type Sprite } from '../atlas';
import { LAUNCH_DURATION, TIER_LEN } from '../config';
import type { PilotView } from '../pilot';
import { approach, type Rgb } from '../util';
import { SHIP_BASE_OFFSET, type View } from '../view';

/** Centre of the name pill, above the ship's anchor. */
const NAME_Y = -66;
const NAME_FONT = '600 13px "Segoe UI", system-ui, sans-serif';

/** Top of the hull row below the ship's anchor, before it eases down clear of the plume. */
const BARS_Y = 46;

const SEG_W = 14;
const SEG_H = 7;
const SEG_GAP = 4;
const BAR_H = 6;

/** Roughly how far the blastoff exhaust cloud reaches below the ship's base. */
const BLASTOFF_REACH = 130;

const DAMAGE_TINT: Rgb = [70, 70, 78];
const DAMAGE_SCALE = 0.28;

/**
 * How far the rocket's drawing reaches from its anchor: up to the top of the name
 * pill, and down past the blastoff cloud and the readouts at their lowest.
 */
const REACH_UP = 80;
const REACH_DOWN = 200;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * One pilot's ship, local or remote.
 *
 * Every rocket sheet exposes exactly the same animation names, so nothing in here
 * branches on which rocket it is drawing: swapping ships is {@link useRocket} and
 * nothing else. Every frame in a sheet also shares the ship-centre anchor, which
 * is why the thruster, zap and blastoff frames line up at the same position with
 * no per-animation offset maths, even though the blastoff cell is wider.
 *
 * Drawn thruster, ship, zap, as the sheet's README specifies, then the name pill
 * and readouts that travel with it.
 */
export class Rocket {
  /** False until a remote pilot's first snapshot arrives. */
  visible = true;

  private _ship!: Sprite;
  private _thrust!: Clip[];
  private _zap!: Clip;
  private _blastoff!: Clip;
  private readonly _smoke: Sprite;

  /** The callsign on the pill above the nose. */
  private readonly _label: string;
  private _labelW = -1;

  private _pilot: PilotView | null = null;
  private _x = 0;
  private _y = 0;
  private _barDrop = 0;

  /**
   * This rocket's own animation clock. It starts at a random offset so a field
   * of plumes never flickers in lockstep.
   */
  private _clock = Math.random() * 10;
  /** Clock time ignition was fired, or null if it never was for this rocket. */
  private _blastoffAt: number | null = null;

  /** Damage smoke comes off the effects sheet, which the ship sheets do not carry. */
  constructor(ship: Atlas, effects: Atlas, label: string) {
    this._label = label;
    this._smoke = effects.tinted('smoke_1', DAMAGE_TINT);
    this.useRocket(ship);
  }

  /**
   * Point the ship at a different sheet. The anchor is identical in every rocket
   * file, so this is genuinely the only call site that changes.
   */
  useRocket(atlas: Atlas): void {
    this._ship = atlas.sprite('ship');
    this._thrust = TIER_LEN.map((_, i) => atlas.clip(`thrust_t${i}`));
    this._zap = atlas.clip('zap');
    this._blastoff = atlas.clip('blastoff');
  }

  /** Fire the ignition animation. Non-looping, ~1.14s, matched to LAUNCH_DURATION. */
  playBlastoff(): void {
    this._blastoffAt = this._clock;
  }

  /**
   * Place this rocket for the frame.
   *
   * `x` and `y` are passed in rather than read off the view, because every pilot
   * sits in their own lane and at their own height. The view's `cx`/`shipY` are
   * the local pilot's, and using them here drew the whole field on top of you.
   */
  sync(pilot: PilotView, dt: number, x: number, y: number): void {
    this._pilot = pilot;
    this._x = x;
    this._y = y;
    this._clock += dt;

    // The readouts slide down to stay clear of the exhaust as it grows, so a lit
    // thruster never covers them.
    const flameTip =
      pilot.launchT > 0
        ? SHIP_BASE_OFFSET + BLASTOFF_REACH
        : this._lit(pilot)
          ? SHIP_BASE_OFFSET + TIER_LEN[pilot.tier]
          : 0;
    this._barDrop = approach(this._barDrop, Math.max(0, flameTip + 12 - BARS_Y), 8, dt);
  }

  draw(ctx: CanvasRenderingContext2D, view: View): void {
    const pilot = this._pilot;
    if (!this.visible || !pilot) return;
    const x = this._x;
    const y = this._y;
    // Other pilots are usually well off screen, and their name pill, plume and
    // readouts are no use to anyone there.
    if (y + REACH_DOWN < 0 || y - REACH_UP > view.h) return;
    ctx.save();

    if (pilot.launchT > 0) {
      // Timed from the ignition event where there was one. A remote pilot whose
      // launch event never arrived still gets the right frame, off their state.
      const t =
        this._blastoffAt === null ? LAUNCH_DURATION - pilot.launchT : this._clock - this._blastoffAt;
      drawSprite(ctx, frameAt(this._blastoff, t), x, y);
    } else if (this._lit(pilot)) {
      drawSprite(ctx, frameAt(this._thrust[pilot.tier], this._clock), x, y);
    }

    drawSprite(ctx, this._ship, x, y);

    // Damage smoke, strongest just before a breach.
    const dmg = 1 - pilot.hull / pilot.maxHull;
    if (dmg > 0.2) {
      ctx.globalAlpha = Math.min(0.5, dmg);
      drawSprite(ctx, this._smoke, x + 6, y - 4 + Math.sin(view.time * 5) * 3, DAMAGE_SCALE);
      ctx.globalAlpha = 1;
    }

    if (pilot.phase === 'stalled') drawSprite(ctx, frameAt(this._zap, this._clock), x, y);

    this._drawName(ctx, x, y + NAME_Y);
    this._drawBars(ctx, pilot, x, y + BARS_Y + this._barDrop);
    ctx.restore();
  }

  /**
   * The plume is speed driven and dies the moment speed does, which is what makes
   * a mistake visible rather than merely costly.
   */
  private _lit(pilot: PilotView): boolean {
    return pilot.launched && pilot.speed > 0 && pilot.launchT <= 0;
  }

  private _drawName(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.font = NAME_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this._labelW < 0) this._labelW = ctx.measureText(this._label).width;

    const pillW = this._labelW + 20;
    const pillH = 20;
    roundRect(ctx, x - pillW / 2, y - pillH / 2, pillW, pillH, 6);
    ctx.fillStyle = 'rgba(10, 12, 24, 0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 140, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#e8ecff';
    ctx.fillText(this._label, x, y + 1);
  }

  /** Hull segments over a speed bar, centred on `x` with the hull row's top at `top`. */
  private _drawBars(ctx: CanvasRenderingContext2D, pilot: PilotView, x: number, top: number): void {
    const maxHull = pilot.maxHull;
    const hullW = maxHull * SEG_W + (maxHull - 1) * SEG_GAP;
    const left = x - hullW / 2;

    // shadowBlur is measured in canvas px and ignores the transform, so it is
    // scaled by hand to keep the glow the same size at every window size.
    const px = ctx.getTransform().a;

    for (let i = 0; i < maxHull; i++) {
      if (i < pilot.hull) {
        ctx.shadowColor = '#ff5d6c';
        ctx.shadowBlur = 6 * px;
        ctx.fillStyle = '#ff5d6c';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#2a3050';
      }
      ctx.fillRect(left + i * (SEG_W + SEG_GAP), top, SEG_W, SEG_H);
    }
    ctx.shadowBlur = 0;

    const barY = top + SEG_H + 7;
    roundRect(ctx, left, barY, hullW, BAR_H, BAR_H / 2);
    ctx.fillStyle = 'rgba(18, 22, 42, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 140, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const ratio = pilot.speedRatio;
    if (ratio > 0.005) {
      // The gradient spans the whole track rather than the fill, so a given speed
      // always reads as the same colour instead of the hues stretching with it.
      const g = ctx.createLinearGradient(left, 0, left + hullW, 0);
      g.addColorStop(0, '#4c8bff');
      g.addColorStop(0.55, '#6dffb0');
      g.addColorStop(1, '#ffcf6b');

      ctx.save();
      roundRect(ctx, left, barY, hullW, BAR_H, BAR_H / 2);
      ctx.clip();
      if (ratio >= 0.995) {
        ctx.shadowColor = '#ffcf6b';
        ctx.shadowBlur = 9 * px;
      }
      ctx.fillStyle = g;
      ctx.fillRect(left, barY, hullW * ratio, BAR_H);
      ctx.restore();
    }
  }
}
