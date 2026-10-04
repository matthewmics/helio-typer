import { type Atlas, type Clip, frameAt } from '../atlas';
import { FINISH_LINE_Y, FINISH_REVEAL_AT } from '../config';
import { clamp } from '../util';
import type { View } from '../view';
import { drawStrip } from './TiledStrip';

/**
 * The finish line: the edge of the solar system, where the solar wind stalls
 * against interstellar space.
 *
 * A wall, not a disc. Everything else on the run is a body you pass, so making the
 * finish another disc would land the moment you have been climbing toward for the
 * whole race as "one more planet". A full-width curtain is a different kind of
 * object, and it suits a locked camera because there is no way to read it as being
 * off to one side.
 *
 * It is not there at the start. Like the castle coming into view late in a Mario
 * level, it fades in at the exact spot it will always occupy and then never moves.
 * `FINISH_LINE_Y` is the shock front itself, which is the y the ship must reach.
 *
 * Composited additively, as assets/finish/README.md asks. It is a glow sheet, so
 * every pixel only ever brightens what is behind it, and the stars behind the
 * curtain shine through instead of being dimmed.
 */
export class Heliopause {
  private readonly _shimmer: Clip;

  constructor(finish: Atlas) {
    this._shimmer = finish.clip('heliopause');
  }

  draw(ctx: CanvasRenderingContext2D, view: View): void {
    const reveal = clamp((view.progress - FINISH_REVEAL_AT) / (1 - FINISH_REVEAL_AT), 0, 1);
    if (reveal <= 0.001) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = reveal;
    // Every tile shows the same frame, picked off the clock. Two tiles a frame
    // apart would tear the seam open.
    drawStrip(ctx, frameAt(this._shimmer, view.time), view.w, FINISH_LINE_Y);
    ctx.restore();
  }
}
