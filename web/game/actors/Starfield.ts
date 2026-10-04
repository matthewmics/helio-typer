import { type Atlas, drawSprite, type Sprite } from '../atlas';
import { STAR_COUNT, TWINKLE_DEPTH, TWINKLE_RATE, TWINKLE_SCALE } from '../config';
import { rand, type Rgb, smoothstep } from '../util';
import type { View } from '../view';

interface Star {
  sprite: Sprite;
  x: number;
  /** Base y in a band three viewports tall, so scrolling can wrap it. */
  y: number;
  /** 1 is the far layer (dim, slow), 2 is near (bright, fast). */
  layer: 1 | 2;
  /** Draw scale at full brightness. Twinkle shrinks it from here. */
  scale: number;
  /** Twinkle: own cycle rate, own dip depth, own offset into the cycle. */
  rate: number;
  depth: number;
  phase: number;
}

/** Most stars are white. A minority run warm or cold, which stops the field reading as grey noise. */
const TINTS: readonly Rgb[] = [
  [255, 255, 255],
  [255, 255, 255],
  [255, 255, 255],
  [255, 255, 255],
  [255, 255, 255],
  [255, 226, 190],
  [190, 214, 255],
];

/** A star sprite tops out around 24px across, so this is safely past the edge. */
const OFFSCREEN = 24;

/**
 * Stars are invisible at ground level and fade in through the middle of the climb.
 *
 * The drift is cosmetic. It runs off the eased camera speed rather than actual
 * position, because the ship's real travel is already sold by its screen y and by
 * the planets going past.
 *
 * Uses `effects/star` rather than filled circles: the sprite is a soft glow, which
 * reads better than a hard `arc()` dot at these sizes.
 *
 * Every star twinkles on its own rate and phase. Brightness and size dip together,
 * because a point of light that only fades reads as a dot on a dimmer switch,
 * while one that fades and tightens reads as scintillation.
 */
export class Starfield {
  private readonly _stars: Star[] = [];
  private _width = 0;
  private _height = 0;

  constructor(effects: Atlas) {
    for (let i = 0; i < STAR_COUNT; i++) {
      const layer: 1 | 2 = Math.random() < 0.7 ? 1 : 2;
      // The sprite's hard core is only 1.2px across at scale 1, so anything much
      // under a quarter scale is pure halo and disappears against the sky. This
      // range keeps every star above that floor.
      const r = rand(0.9, 3);

      this._stars.push({
        sprite: effects.tinted('star', TINTS[Math.floor(Math.random() * TINTS.length)]),
        x: 0,
        y: 0,
        layer,
        scale: r / 4,
        rate: rand(TWINKLE_RATE[0], TWINKLE_RATE[1]),
        depth: rand(TWINKLE_DEPTH[0], TWINKLE_DEPTH[1]),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /** Scatter across the viewport. Runs on the first frame and again on resize. */
  private _layout(width: number, height: number): void {
    this._width = width;
    this._height = height;
    for (const s of this._stars) {
      s.x = Math.random() * width;
      s.y = Math.random() * height * 3 - height;
    }
  }

  draw(ctx: CanvasRenderingContext2D, view: View): void {
    if (view.w !== this._width || view.h !== this._height) this._layout(view.w, view.h);

    const alpha = smoothstep(0.26, 0.68, view.atmo);
    if (alpha <= 0.01) return;
    const band = view.h * 3;

    ctx.save();
    for (const s of this._stars) {
      const drift = view.worldScroll * (s.layer === 1 ? 0.4 : 1);
      let y = (s.y + drift) % band;
      if (y < 0) y += band;
      y -= view.h;
      if (y < -OFFSCREEN || y > view.h + OFFSCREEN) continue;

      // 1 at the top of the cycle, 1 - depth at the bottom.
      const twinkle = 1 - s.depth * (0.5 - 0.5 * Math.sin(view.time * s.rate + s.phase));
      ctx.globalAlpha = (s.layer === 1 ? 0.75 : 1) * alpha * twinkle;
      drawSprite(ctx, s.sprite, s.x, y, s.scale * (1 - TWINKLE_SCALE + TWINKLE_SCALE * twinkle));
    }
    ctx.restore();
  }
}
