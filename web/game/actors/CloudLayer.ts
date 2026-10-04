import { type Atlas, drawSpriteTransformed, type Sprite } from '../atlas';
import { CLOUD_BILLOW, CLOUD_COUNT, CLOUD_ROLL, CLOUD_SPREAD, CLOUD_WIND } from '../config';
import { rand, randInt, type Rgb, smoothstep } from '../util';
import type { View } from '../view';

const DEG = Math.PI / 180;

/** Near silhouettes: less air between you and them, so they read almost black. */
const FG_TINT: Rgb = [26, 28, 48];
/** Far haze. */
const BG_TINT: Rgb = [66, 70, 104];

interface Cloud {
  body: Sprite;
  rim: Sprite;
  /** Draw scale of the texture, before the billow. */
  scale: number;
  /** Altitude in `atmo` space, i.e. where in the atmosphere window it sits. */
  alt: number;
  /** Horizontal position as a fraction of viewport width. */
  x: number;
  /** Parallax factor: nearer clouds sweep by faster. */
  depth: number;
  fg: boolean;
  /** Half the cell width in world px, for wrapping the wind drift off-screen. */
  half: number;
  /** Lateral wind speed in px/sec, before parallax. */
  wind: number;
  /** Own offset and rates for the billow and roll cycles. */
  phase: number;
  billowX: number;
  billowY: number;
  rollRate: number;

  /** This frame's placement, worked out by the body pass and reused by the rim pass. */
  shown: boolean;
  px: number;
  py: number;
  sx: number;
  sy: number;
  roll: number;
}

/**
 * Real cloud objects at fixed altitudes that physically stream past the ship.
 *
 * A quarter of them are foreground and draw in front of the rocket, which is what
 * actually sells the depth. The rim overlay is the warm sunset edge on top,
 * authored at full strength and faded down as you climb above the light.
 *
 * The cloud textures are white with form shading baked in, so both moods come out
 * of one texture by tinting, exactly as assets/environment/README.md intends.
 *
 * Each texture is a still, so the weather itself is animated here: a lateral wind
 * that wraps around the screen, an x/y billow on separate cycles so the silhouette
 * churns rather than pumps, and a lazy roll. All of it is per-cloud and scaled by
 * parallax depth, so a near cloud visibly races a far one.
 */
export class CloudLayer {
  private readonly _clouds: Cloud[] = [];

  constructor(env: Atlas) {
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const shape = randInt(0, 4);
      const fg = Math.random() < 0.25;
      const scale = rand(0.55, 1.1) * (fg ? 1.7 : 1);

      this._clouds.push({
        body: env.tinted(`cloud_${shape}`, fg ? FG_TINT : BG_TINT),
        // The rim shares the cloud's cell, so drawing it with the same transform
        // lines it up exactly.
        rim: env.sprite(`cloud_${shape}_rim`),
        scale,
        alt: rand(0.05, 0.5),
        x: Math.random(),
        depth: rand(0.5, 1.2),
        fg,
        half: (env.frame(`cloud_${shape}`).w * scale) / 2,
        wind: rand(CLOUD_WIND[0], CLOUD_WIND[1]),
        phase: Math.random() * Math.PI * 2,
        billowX: rand(0.1, 0.22),
        billowY: rand(0.13, 0.27),
        rollRate: rand(0.07, 0.16),
        shown: false,
        px: 0,
        py: 0,
        sx: 1,
        sy: 1,
        roll: 0,
      });
    }
  }

  /** The clouds the rockets fly in front of. */
  drawBehind(ctx: CanvasRenderingContext2D, view: View): void {
    this._draw(ctx, view, false);
  }

  /** The near silhouettes that pass in front of the rockets. */
  drawInFront(ctx: CanvasRenderingContext2D, view: View): void {
    this._draw(ctx, view, true);
  }

  /** Every body in the band first, then every rim over them. */
  private _draw(ctx: CanvasRenderingContext2D, view: View, front: boolean): void {
    // Once you are above the weather the whole band is gone for good.
    const fade = 1 - smoothstep(0.5, 0.64, view.atmo);
    if (fade <= 0.01) return;
    const rimStrength = (1 - smoothstep(0.04, 0.3, view.atmo)) * 0.55;

    ctx.save();
    for (const c of this._clouds) {
      c.shown = c.fg === front && this._place(c, view);
      if (!c.shown) continue;
      ctx.globalAlpha = (c.fg ? 0.94 : 0.82) * fade * (c.fg ? 0.95 : 1);
      drawSpriteTransformed(ctx, c.body, c.px, c.py, c.sx, c.sy, c.roll);
    }

    if (rimStrength > 0.01) {
      for (const c of this._clouds) {
        if (!c.shown) continue;
        // The rim takes the body's exact transform, or the sunset edge slides off
        // the shape it belongs to.
        ctx.globalAlpha = fade * (c.fg ? 0.95 : 1) * rimStrength;
        drawSpriteTransformed(ctx, c.rim, c.px, c.py, c.sx, c.sy, c.roll);
      }
    }
    ctx.restore();
  }

  /** Work out where this cloud sits this frame. False if it is off screen. */
  private _place(c: Cloud, view: View): boolean {
    const y = view.shipY + (view.atmo - c.alt) * CLOUD_SPREAD * c.depth;
    if (y <= -300 || y >= view.h + 300) return false;

    // Wind, wrapped through a band one cloud-width wider than the screen at each
    // end, so a cloud slides off one side and returns from the other rather than
    // popping out of existence at the edge.
    const t = view.time;
    const band = view.w + c.half * 2;
    let x = (c.x * view.w + t * c.wind * c.depth + c.half) % band;
    if (x < 0) x += band;

    c.px = x - c.half;
    c.py = y;
    c.sx = c.scale * (1 + Math.sin(t * c.billowX + c.phase) * CLOUD_BILLOW);
    c.sy = c.scale * (1 - Math.sin(t * c.billowY + c.phase * 1.7) * CLOUD_BILLOW * 0.7);
    c.roll = Math.sin(t * c.rollRate + c.phase) * CLOUD_ROLL * DEG;
    return true;
  }
}
