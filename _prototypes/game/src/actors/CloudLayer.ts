import { Actor, Color, type Scene, vec } from 'excalibur';
import type { Atlas } from '../atlas';
import {
  CLOUD_BILLOW,
  CLOUD_COUNT,
  CLOUD_ROLL,
  CLOUD_SPREAD,
  CLOUD_WIND,
  Z,
} from '../config';
import { rand, randInt, smoothstep } from '../util';
import type { View } from '../view';

const DEG = Math.PI / 180;

/** Near silhouettes: less air between you and them, so they read almost black. */
const FG_TINT = Color.fromRGB(26, 28, 48);
/** Far haze. */
const BG_TINT = Color.fromRGB(66, 70, 104);

interface Cloud {
  body: Actor;
  rim: Actor;
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
}

/**
 * Real cloud objects at fixed altitudes that physically stream past the ship.
 *
 * A quarter of them are foreground and draw in front of the rocket, which is what
 * actually sells the depth. The `_rim` overlay is the warm sunset edge on top,
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

  constructor(scene: Scene, env: Atlas) {
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const shape = randInt(0, 4);
      const fg = Math.random() < 0.25;
      const scale = rand(0.55, 1.1) * (fg ? 1.7 : 1);

      const bodySprite = env.sprite(`cloud_${shape}`);
      bodySprite.tint = fg ? FG_TINT : BG_TINT;
      bodySprite.scale.setTo(scale, scale);

      const rimSprite = env.sprite(`cloud_${shape}_rim`);
      rimSprite.scale.setTo(scale, scale);

      const z = fg ? Z.cloudsFront : Z.cloudsBack;

      const body = new Actor({ name: `cloud${i}`, pos: vec(0, 0), z });
      body.graphics.anchor = env.anchorOf(`cloud_${shape}`);
      body.graphics.use(bodySprite);
      body.graphics.opacity = fg ? 0.94 : 0.82;

      // The rim shares the cloud's cell, so drawing it at the same position lines
      // it up exactly. Separate actor because its alpha fades independently.
      const rim = new Actor({ name: `cloudRim${i}`, pos: vec(0, 0), z: z + 1 });
      rim.graphics.anchor = env.anchorOf(`cloud_${shape}_rim`);
      rim.graphics.use(rimSprite);

      scene.add(body);
      scene.add(rim);

      this._clouds.push({
        body,
        rim,
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
      });
    }
  }

  sync(view: View): void {
    // Once you are above the weather the whole band is gone for good.
    const fade = 1 - smoothstep(0.5, 0.64, view.atmo);
    const rimStrength = (1 - smoothstep(0.04, 0.3, view.atmo)) * 0.55;

    for (const c of this._clouds) {
      if (fade <= 0.01) {
        c.body.graphics.visible = false;
        c.rim.graphics.visible = false;
        continue;
      }

      const y = view.shipY + (view.atmo - c.alt) * CLOUD_SPREAD * c.depth;
      const onScreen = y > -300 && y < view.h + 300;
      c.body.graphics.visible = onScreen;
      c.rim.graphics.visible = onScreen && rimStrength > 0.01;
      if (!onScreen) continue;

      // Wind, wrapped through a band one cloud-width wider than the screen at
      // each end, so a cloud slides off one side and returns from the other
      // rather than popping out of existence at the edge.
      const t = view.time;
      const band = view.w + c.half * 2;
      let x = (c.x * view.w + t * c.wind * c.depth + c.half) % band;
      if (x < 0) x += band;
      x -= c.half;

      const roll = Math.sin(t * c.rollRate + c.phase) * CLOUD_ROLL * DEG;
      const sx = 1 + Math.sin(t * c.billowX + c.phase) * CLOUD_BILLOW;
      const sy = 1 - Math.sin(t * c.billowY + c.phase * 1.7) * CLOUD_BILLOW * 0.7;

      c.body.pos.setTo(x, y);
      c.body.scale.setTo(sx, sy);
      c.body.rotation = roll;
      // The rim shares the body's cell, so it has to take the exact same
      // transform or the sunset edge slides off the shape it belongs to.
      c.rim.pos.setTo(x, y);
      c.rim.scale.setTo(sx, sy);
      c.rim.rotation = roll;

      const alpha = fade * (c.fg ? 0.95 : 1);
      c.body.graphics.opacity = (c.fg ? 0.94 : 0.82) * alpha;
      c.rim.graphics.opacity = alpha * rimStrength;
    }
  }
}
