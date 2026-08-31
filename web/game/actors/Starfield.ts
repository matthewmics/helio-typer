import { Actor, Color, type Scene, type Sprite, vec } from 'excalibur';
import type { Atlas } from '../atlas';
import { STAR_COUNT, TWINKLE_DEPTH, TWINKLE_RATE, TWINKLE_SCALE, Z } from '../config';
import { rand } from '../util';
import { smoothstep } from '../util';
import type { View } from '../view';

interface Star {
  actor: Actor;
  sprite: Sprite;
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
const TINTS = [
  Color.White,
  Color.White,
  Color.White,
  Color.White,
  Color.White,
  Color.fromRGB(255, 226, 190),
  Color.fromRGB(190, 214, 255),
];

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

  constructor(scene: Scene, effects: Atlas) {
    for (let i = 0; i < STAR_COUNT; i++) {
      const layer: 1 | 2 = Math.random() < 0.7 ? 1 : 2;
      // The sprite's hard core is only 1.2px across at scale 1, so anything much
      // under a quarter scale is pure halo and disappears against the sky. This
      // range keeps every star above that floor.
      const r = rand(0.9, 3);
      const scale = r / 4;

      const sprite = effects.sprite('star');
      sprite.tint = TINTS[Math.floor(Math.random() * TINTS.length)];
      sprite.scale.setTo(scale, scale);

      const actor = new Actor({ name: `star${i}`, pos: vec(0, 0), z: Z.stars });
      actor.graphics.anchor = effects.anchorOf('star');
      actor.graphics.use(sprite);
      actor.graphics.opacity = 0;

      this._stars.push({
        actor,
        sprite,
        y: 0,
        layer,
        scale,
        rate: rand(TWINKLE_RATE[0], TWINKLE_RATE[1]),
        depth: rand(TWINKLE_DEPTH[0], TWINKLE_DEPTH[1]),
        phase: Math.random() * Math.PI * 2,
      });
      scene.add(actor);
    }
  }

  /** Scatter across the current viewport. Called on start and on resize. */
  layout(width: number, height: number): void {
    this._width = width;
    this._height = height;
    for (const s of this._stars) {
      s.actor.pos.x = Math.random() * width;
      s.y = Math.random() * height * 3 - height;
    }
  }

  sync(view: View): void {
    if (view.w !== this._width || view.h !== this._height) this.layout(view.w, view.h);

    const alpha = smoothstep(0.26, 0.68, view.atmo);
    const band = view.h * 3;

    for (const s of this._stars) {
      // 1 at the top of the cycle, 1 - depth at the bottom.
      const twinkle = 1 - s.depth * (0.5 - 0.5 * Math.sin(view.time * s.rate + s.phase));

      s.actor.graphics.opacity = (s.layer === 1 ? 0.75 : 1) * alpha * twinkle;
      if (alpha <= 0.01) continue;

      const k = s.scale * (1 - TWINKLE_SCALE + TWINKLE_SCALE * twinkle);
      s.sprite.scale.setTo(k, k);

      const drift = view.worldScroll * (s.layer === 1 ? 0.4 : 1);
      let y = (s.y + drift) % band;
      if (y < 0) y += band;
      s.actor.pos.y = y - view.h;
    }
  }
}
