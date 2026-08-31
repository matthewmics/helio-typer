import { type Scene, type Sprite } from 'excalibur';
import type { Atlas } from '../atlas';
import { FINISH_LINE_Y, FINISH_REVEAL_AT, Z } from '../config';
import { clamp } from '../util';
import type { View } from '../view';
import { TiledStrip } from './TiledStrip';

/** Shimmer rate from assets/finish/finish.json. */
const FPS = 6;

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
 * NOTE: assets/finish/README.md asks for additive compositing. Excalibur 0.32 has
 * no blend-mode API on the graphics context, so this draws with normal alpha.
 * Over the near-black sky of the outer system the two are almost identical; the
 * only visible difference is that stars behind the curtain are dimmed rather than
 * shining through.
 */
export class Heliopause {
  private readonly _frames: Sprite[];
  private readonly _tiles: TiledStrip;

  constructor(scene: Scene, finish: Atlas) {
    this._frames = finish.spritesOf('heliopause');
    this._tiles = new TiledStrip(
      scene,
      'heliopause',
      finish.frame('heliopause_0').w,
      finish.anchorOf('heliopause_0'),
      Z.heliopause,
    );
  }

  sync(view: View): void {
    const reveal = clamp((view.progress - FINISH_REVEAL_AT) / (1 - FINISH_REVEAL_AT), 0, 1);

    // Every tile shows the same frame, driven off the clock rather than a shared
    // Animation instance. Two tiles a frame apart would tear the seam open.
    const frame = this._frames[Math.floor(view.time * FPS) % this._frames.length];
    this._tiles.sync(view.w, FINISH_LINE_Y, reveal, frame);
  }
}
