import { Actor, type Graphic, type Scene, type Vector, vec } from 'excalibur';

/**
 * A horizontally repeating strip: the ground layers and the heliopause.
 *
 * Both READMEs make the same promise, that the patterns are sums of sines at
 * integer frequencies over the cell width, so `x = 0` and `x = cellWidth`
 * evaluate identically and the seam is invisible at any viewport size. That is
 * only true if the tiles are placed at exact multiples of the cell width, which
 * is the one thing this class exists to guarantee.
 *
 * Tiles are grown on demand so widening the window never opens a gap.
 */
export class TiledStrip {
  private readonly _tiles: Actor[] = [];
  private _shown: Graphic | null = null;

  constructor(
    private readonly _scene: Scene,
    private readonly _name: string,
    private readonly _cellWidth: number,
    private readonly _anchor: Vector,
    private readonly _z: number,
  ) {}

  /**
   * @param graphic  the frame to show this tick, shared by every tile so an
   *                 animated strip never tears across the seam
   */
  sync(width: number, y: number, opacity: number, graphic: Graphic): void {
    const needed = opacity <= 0.001 ? 0 : Math.ceil(width / this._cellWidth) + 1;

    while (this._tiles.length < needed) {
      const actor = new Actor({
        name: `${this._name}${this._tiles.length}`,
        pos: vec(0, 0),
        z: this._z,
      });
      actor.graphics.anchor = this._anchor;
      this._tiles.push(actor);
      this._scene.add(actor);
    }

    // Only re-`use` when the frame actually changed: swapping the graphic every
    // tick would restart it, which matters the moment a strip is animated.
    const changed = graphic !== this._shown;
    this._shown = graphic;

    for (let i = 0; i < this._tiles.length; i++) {
      const tile = this._tiles[i];
      if (i >= needed) {
        tile.graphics.visible = false;
        continue;
      }
      tile.graphics.visible = true;
      tile.graphics.opacity = opacity;
      if (changed || tile.graphics.current !== graphic) tile.graphics.use(graphic);
      tile.pos.setTo(i * this._cellWidth, y);
    }
  }
}
