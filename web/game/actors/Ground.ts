import { Actor, Canvas, type Scene, vec } from 'excalibur';
import type { Atlas } from '../atlas';
import { Z } from '../config';
import type { View } from '../view';
import { TiledStrip } from './TiledStrip';

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
  private readonly _glow: Actor;
  private readonly _skyline: TiledStrip;
  private readonly _hillsFar: TiledStrip;
  private readonly _hillsNear: TiledStrip;
  private readonly _pad: Actor;

  private readonly _env: Atlas;

  constructor(scene: Scene, env: Atlas) {
    this._env = env;

    this._glow = new Actor({ name: 'horizonGlow', pos: vec(0, 0), z: Z.horizonGlow });
    this._glow.graphics.anchor = vec(0, 1); // bottom-left sits on the horizon
    this._glow.graphics.use(
      new Canvas({
        width: 8,
        height: GLOW_H,
        cache: true,
        smoothing: true,
        draw: (ctx) => {
          const g = ctx.createLinearGradient(0, 0, 0, GLOW_H);
          g.addColorStop(0, 'rgba(226, 130, 82, 0)');
          g.addColorStop(1, 'rgba(255, 152, 92, 0.5)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 8, GLOW_H);
        },
      }),
    );
    scene.add(this._glow);

    this._skyline = new TiledStrip(scene, 'skyline', env.frame('skyline').w, env.anchorOf('skyline'), Z.skyline);
    this._hillsFar = new TiledStrip(scene, 'hillsFar', env.frame('hills_far').w, env.anchorOf('hills_far'), Z.hillsFar);
    this._hillsNear = new TiledStrip(
      scene,
      'hillsNear',
      env.frame('hills_near').w,
      env.anchorOf('hills_near'),
      Z.hillsNear,
    );

    // The pad anchor is the deck surface, so it lines up with the ship's base
    // without any slab-thickness maths.
    this._pad = new Actor({ name: 'pad', pos: vec(0, 0), z: Z.pad });
    this._pad.graphics.anchor = env.anchorOf('pad');
    this._pad.graphics.use(env.sprite('pad'));
    scene.add(this._pad);
  }

  sync(view: View): void {
    const base = view.groundY - view.groundFall;
    const gone = view.groundY > view.h + 320;

    // Further layers fall more slowly.
    const skylineY = base + view.groundFall * 0.86;
    const farY = base + view.groundFall * 0.92;

    const glowVisible = !gone;
    this._glow.graphics.visible = glowVisible;
    if (glowVisible) {
      this._glow.pos.setTo(0, skylineY);
      const canvas = this._glow.graphics.current as Canvas | undefined;
      canvas?.scale.setTo(view.w / 8, 1);
    }

    const opacity = gone ? 0 : 1;
    this._skyline.sync(view.w, skylineY, opacity, this._graphic('skyline'));
    this._hillsFar.sync(view.w, farY, opacity, this._graphic('hills_far'));
    this._hillsNear.sync(view.w, view.groundY, opacity, this._graphic('hills_near'));

    this._pad.graphics.visible = !gone;
    this._pad.pos.setTo(view.cx, view.groundY);
  }

  /** One sprite instance per frame name, reused across every tile of that strip. */
  private readonly _cache = new Map<string, ReturnType<Atlas['sprite']>>();
  private _graphic(name: string) {
    let g = this._cache.get(name);
    if (!g) {
      g = this._env.sprite(name);
      this._cache.set(name, g);
    }
    return g;
  }
}
