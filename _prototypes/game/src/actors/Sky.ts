import { Actor, Canvas, Vector, vec } from 'excalibur';
import { Z } from '../config';
import { skyColors } from '../util';
import type { View } from '../view';

/**
 * The sky is deliberately not art.
 *
 * assets/environment/README.md is explicit that the gradient stays as code:
 * baking it into sprites reproduces the muddy smear that protoype.md recorded as
 * a dead end. So this is ONE gradient whose two stop colours are lerped through
 * five keyframes, exactly as the canvas prototype had it.
 *
 * It is rasterised into a tiny 8x128 canvas and stretched over the viewport. A
 * two stop vertical gradient survives that perfectly, and it means the per-frame
 * re-raster costs a thousand pixels instead of two million.
 */
const SRC_W = 8;
const SRC_H = 128;

/** Slack on every edge so camera shake can never expose the sky's border. */
const MARGIN = 48;

export class Sky extends Actor {
  private readonly _canvas: Canvas;
  private _top = 'rgb(26,34,72)';
  private _bot = 'rgb(206,116,76)';

  constructor() {
    super({ name: 'sky', pos: vec(0, 0), z: Z.sky });

    this._canvas = new Canvas({
      width: SRC_W,
      height: SRC_H,
      cache: false,
      smoothing: true,
      draw: (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, SRC_H);
        g.addColorStop(0, this._top);
        g.addColorStop(1, this._bot);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, SRC_W, SRC_H);
      },
    });

    this.graphics.anchor = Vector.Zero;
    this.graphics.use(this._canvas);
  }

  sync(view: View): void {
    const { top, bot } = skyColors(view.atmo);
    this._top = top;
    this._bot = bot;

    this.pos.setTo(-MARGIN, -MARGIN);
    this._canvas.scale.setTo((view.w + MARGIN * 2) / SRC_W, (view.h + MARGIN * 2) / SRC_H);
  }
}
