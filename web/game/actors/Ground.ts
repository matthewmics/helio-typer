import { type Atlas, drawSprite, type Sprite } from '../atlas';
import { EDGE_BLEED } from '../config';
import type { View } from '../view';
import { drawStrip } from './TiledStrip';

const GLOW_H = 190;

/**
 * Dusk, roughly 6pm: a warm band on the horizon, a backlit skyline, two ridgelines
 * and the pad the rocket is standing on.
 *
 * The whole stack falls away in the first few percent of the climb and never comes
 * back. Layers fall at slightly different rates, which is the only parallax
 * available here: the camera never pans sideways, so depth has to come from
 * vertical rate alone.
 */
export class Ground {
  private readonly _skyline: Sprite;
  private readonly _hillsFar: Sprite;
  private readonly _hillsNear: Sprite;
  private readonly _pad: Sprite;
  /** The near ridge's solid fill, read off the bottom row of its art. */
  private readonly _earth: string;

  constructor(env: Atlas) {
    // Isolated because the sheet packs these three edge to edge, each one's solid
    // base right on top of the next one's empty sky, which would otherwise show
    // as a hairline across the whole screen at the top of every strip.
    this._skyline = env.isolated('skyline');
    this._hillsFar = env.isolated('hills_far');
    this._hillsNear = env.isolated('hills_near');
    // The pad anchor is the deck surface, so it lines up with the ship's base
    // without any slab-thickness maths.
    this._pad = env.sprite('pad');
    this._earth = env.colorAt('hills_near', 0, this._hillsNear.h - 1);
  }

  draw(ctx: CanvasRenderingContext2D, view: View): void {
    if (view.groundY > view.h + 320) return;

    // Further layers fall more slowly.
    const base = view.groundY - view.groundFall;
    const skylineY = base + view.groundFall * 0.86;
    const farY = base + view.groundFall * 0.92;

    // The warm band sits on the skyline's horizon and fades out upward.
    const glow = ctx.createLinearGradient(0, skylineY - GLOW_H, 0, skylineY);
    glow.addColorStop(0, 'rgba(226, 130, 82, 0)');
    glow.addColorStop(1, 'rgba(255, 152, 92, 0.5)');
    ctx.fillStyle = glow;
    ctx.fillRect(-EDGE_BLEED, skylineY - GLOW_H, view.w + EDGE_BLEED * 2, GLOW_H);

    drawStrip(ctx, this._skyline, view.w, skylineY);
    drawStrip(ctx, this._hillsFar, view.w, farY);
    drawStrip(ctx, this._hillsNear, view.w, view.groundY);

    // The near ridge's art stops 160px under the horizon, short of the bottom of
    // the screen: by 12px on the pad at 16:9, and by far more in a taller window.
    // Carry its fill on down, tucked a couple of px up under the art so the join
    // can never show.
    const earthTop = view.groundY - this._hillsNear.ay + this._hillsNear.h - 2;
    const earthBottom = view.h + EDGE_BLEED;
    if (earthTop < earthBottom) {
      ctx.fillStyle = this._earth;
      ctx.fillRect(-EDGE_BLEED, earthTop, view.w + EDGE_BLEED * 2, earthBottom - earthTop);
    }

    drawSprite(ctx, this._pad, view.cx, view.groundY);
  }
}
