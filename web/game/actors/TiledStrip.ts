import { drawSprite, type Sprite } from '../atlas';
import { EDGE_BLEED } from '../config';

/**
 * Repeat a horizontally tileable frame across the screen: the ground layers and
 * the heliopause.
 *
 * Both READMEs make the same promise, that the patterns are sums of sines at
 * integer frequencies over the cell width, so `x = 0` and `x = cellWidth`
 * evaluate identically and the seam is invisible at any viewport size. That is
 * only true if the tiles are placed at exact multiples of the cell width, which
 * is the one thing this function exists to guarantee.
 *
 * It starts one whole cell left of the screen, so a shake can never open a gap at
 * the left edge, and runs on until the right edge is covered at any width.
 */
export function drawStrip(ctx: CanvasRenderingContext2D, sprite: Sprite, width: number, y: number): void {
  for (let x = -sprite.w; x < width + EDGE_BLEED; x += sprite.w) {
    drawSprite(ctx, sprite, x, y);
  }
}
