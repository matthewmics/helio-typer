import { EDGE_BLEED } from '../config';
import { skyColors } from '../util';
import type { View } from '../view';

/**
 * The sky is deliberately not art.
 *
 * assets/environment/README.md is explicit that the gradient stays as code:
 * baking it into sprites reproduces the muddy smear that protoype.md recorded as
 * a dead end. So this is ONE gradient whose two stop colours are lerped through
 * five keyframes, exactly as the canvas prototype had it.
 */
export function drawSky(ctx: CanvasRenderingContext2D, view: View): void {
  const { top, bot } = skyColors(view.atmo);
  const g = ctx.createLinearGradient(0, -EDGE_BLEED, 0, view.h + EDGE_BLEED);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(-EDGE_BLEED, -EDGE_BLEED, view.w + EDGE_BLEED * 2, view.h + EDGE_BLEED * 2);
}
