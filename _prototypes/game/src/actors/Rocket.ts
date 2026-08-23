import { Actor, type Animation, AnimationStrategy, Canvas, Color, vec } from 'excalibur';
import type { Atlas } from '../atlas';
import { PLAYER_NAME, TIER_LEN, Z } from '../config';
import type { Race } from '../race';
import { approach } from '../util';
import { SHIP_BASE_OFFSET, type View } from '../view';

const NAME_W = 200;
const NAME_H = 28;

const BARS_W = 240;
const BARS_H = 48;
/** y inside the bars canvas where the hull row starts, leaving room for its glow. */
const BARS_PAD = 12;

const SEG_W = 14;
const SEG_H = 7;
const SEG_GAP = 4;
const BAR_H = 6;

/** Roughly how far the blastoff exhaust cloud reaches below the ship's base. */
const BLASTOFF_REACH = 130;

const DAMAGE_TINT = Color.fromRGB(70, 70, 78);

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
 * The player's ship.
 *
 * Every rocket sheet exposes exactly the same animation names, so nothing in here
 * branches on which rocket it is drawing: swapping ships is {@link useRocket} and
 * nothing else. Every frame in a sheet also shares the ship-centre anchor, which
 * is why the thruster, zap and blastoff frames line up at the same position with
 * no per-animation offset maths.
 *
 * Layered thruster -> ship -> zap, as the sheet's README specifies, using child
 * actors because the blastoff frames use a wider cell (and therefore a different
 * relative anchor) than the rest.
 */
export class Rocket extends Actor {
  private readonly _thrust: Actor;
  private readonly _hull: Actor;
  private readonly _zap: Actor;
  private readonly _blastoff: Actor;
  private readonly _damage: Actor;
  private readonly _bars: Actor;

  private _thrustAnims: Animation[] = [];
  private _zapAnim!: Animation;
  private _blastoffAnim!: Animation;

  private _barDrop = 0;
  private _shownTier = -1;

  /** Read by the bars canvas at draw time. */
  private _race: Race | null = null;

  constructor(atlas: Atlas) {
    super({ name: 'rocket', pos: vec(0, 0), z: Z.rocket });

    this._thrust = new Actor({ name: 'thrust', pos: vec(0, 0), z: Z.rocket - 1 });
    this._blastoff = new Actor({ name: 'blastoff', pos: vec(0, 0), z: Z.rocket - 1 });
    this._hull = new Actor({ name: 'hull', pos: vec(0, 0), z: Z.rocket });
    this._damage = new Actor({ name: 'damage', pos: vec(0, 0), z: Z.rocket + 1 });
    this._zap = new Actor({ name: 'zap', pos: vec(0, 0), z: Z.rocket + 2 });

    const name = new Actor({ name: 'nameTag', pos: vec(0, -66), z: Z.rocket + 3 });
    name.graphics.anchor = vec(0.5, 0.5);
    name.graphics.use(
      new Canvas({
        width: NAME_W,
        height: NAME_H,
        cache: true,
        smoothing: true,
        draw: (ctx) => {
          ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const pillW = ctx.measureText(PLAYER_NAME).width + 20;
          const pillH = 20;
          roundRect(ctx, (NAME_W - pillW) / 2, (NAME_H - pillH) / 2, pillW, pillH, 6);
          ctx.fillStyle = 'rgba(10, 12, 24, 0.7)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(120, 140, 255, 0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#e8ecff';
          ctx.fillText(PLAYER_NAME, NAME_W / 2, NAME_H / 2 + 1);
        },
      }),
    );

    this._bars = new Actor({ name: 'bars', pos: vec(0, 46), z: Z.rocket + 3 });
    this._bars.graphics.anchor = vec(0.5, BARS_PAD / BARS_H);
    this._bars.graphics.use(
      new Canvas({
        width: BARS_W,
        height: BARS_H,
        cache: false,
        smoothing: true,
        draw: (ctx) => this._drawBars(ctx),
      }),
    );

    for (const child of [this._thrust, this._blastoff, this._hull, this._damage, this._zap, name, this._bars]) {
      this.addChild(child);
    }

    this.useRocket(atlas);
  }

  /**
   * Point the ship at a different sheet. The anchor is identical in every rocket
   * file, so this is genuinely the only call site that changes.
   */
  useRocket(atlas: Atlas): void {
    const shipAnchor = atlas.anchorOf('ship');

    this._hull.graphics.anchor = shipAnchor;
    this._hull.graphics.use(atlas.sprite('ship'));

    this._thrust.graphics.anchor = shipAnchor;
    this._thrustAnims = TIER_LEN.map((_, i) => atlas.animation(`thrust_t${i}`));
    this._shownTier = -1;

    this._zap.graphics.anchor = shipAnchor;
    this._zapAnim = atlas.animation('zap');
    this._zap.graphics.use(this._zapAnim);
    this._zap.graphics.visible = false;

    this._blastoff.graphics.anchor = atlas.anchorOf('blastoff_0');
    this._blastoffAnim = atlas.animation('blastoff', { strategy: AnimationStrategy.Freeze });
    this._blastoff.graphics.use(this._blastoffAnim);
    this._blastoff.graphics.visible = false;
  }

  /** Damage smoke needs the effects sheet, which the ship sheets do not carry. */
  useDamageSmoke(effects: Atlas): void {
    const smoke = effects.sprite('smoke_1');
    smoke.tint = DAMAGE_TINT;
    smoke.scale.setTo(0.28, 0.28);
    this._damage.graphics.anchor = effects.anchorOf('smoke_1');
    this._damage.graphics.use(smoke);
    this._damage.graphics.visible = false;
  }

  /** Fire the ignition animation. Non-looping, ~1.14s, matched to LAUNCH_DURATION. */
  playBlastoff(): void {
    this._blastoffAnim.reset();
    this._blastoffAnim.play();
    this._blastoff.graphics.visible = true;
  }

  sync(view: View, race: Race, dt: number): void {
    this._race = race;
    this.pos.setTo(view.cx, view.shipY);

    const launching = race.launchT > 0;
    this._blastoff.graphics.visible = launching;

    // The plume is speed driven and dies the moment speed does, which is what makes
    // a mistake visible rather than merely costly.
    const lit = race.launched && race.speed > 0 && !launching;
    this._thrust.graphics.visible = lit;
    if (lit && race.tier !== this._shownTier) {
      this._shownTier = race.tier;
      this._thrust.graphics.use(this._thrustAnims[race.tier]);
    }
    if (!lit) this._shownTier = -1;

    this._zap.graphics.visible = race.phase === 'stalled';

    // Damage smoke, strongest just before a breach.
    const dmg = 1 - race.hull / race.cfg.maxHull;
    this._damage.graphics.visible = dmg > 0.2;
    if (dmg > 0.2) {
      this._damage.graphics.opacity = Math.min(0.5, dmg);
      this._damage.pos.setTo(6, -4 + Math.sin(view.time * 5) * 3);
    }

    // The readouts slide down to stay clear of the exhaust as it grows, so a lit
    // thruster never covers them.
    const flameTip = launching
      ? SHIP_BASE_OFFSET + BLASTOFF_REACH
      : lit
        ? SHIP_BASE_OFFSET + TIER_LEN[race.tier]
        : 0;
    this._barDrop = approach(this._barDrop, Math.max(0, flameTip + 12 - 46), 8, dt);
    this._bars.pos.setTo(0, 46 + this._barDrop);
  }

  private _drawBars(ctx: CanvasRenderingContext2D): void {
    const race = this._race;
    if (!race) return;

    const maxHull = race.cfg.maxHull;
    const hullW = maxHull * SEG_W + (maxHull - 1) * SEG_GAP;
    const left = (BARS_W - hullW) / 2;

    for (let i = 0; i < maxHull; i++) {
      const x = left + i * (SEG_W + SEG_GAP);
      if (i < race.hull) {
        ctx.shadowColor = '#ff5d6c';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ff5d6c';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#2a3050';
      }
      ctx.fillRect(x, BARS_PAD, SEG_W, SEG_H);
    }
    ctx.shadowBlur = 0;

    const barY = BARS_PAD + SEG_H + 7;
    roundRect(ctx, left, barY, hullW, BAR_H, BAR_H / 2);
    ctx.fillStyle = 'rgba(18, 22, 42, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 140, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const ratio = race.speedRatio;
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
        ctx.shadowBlur = 9;
      }
      ctx.fillStyle = g;
      ctx.fillRect(left, barY, hullW * ratio, BAR_H);
      ctx.restore();
    }
  }
}
