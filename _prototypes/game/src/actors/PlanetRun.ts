import { Actor, type Animation, Color, type Scene, vec } from 'excalibur';
import type { Atlas } from '../atlas';
import {
  PLANET_BREATHE,
  PLANET_HALO_OPACITY,
  PLANET_HALO_SPAN,
  PLANET_SPREAD,
  PLANET_SWAY,
  RUN,
  Z,
  type Leg,
} from '../config';
import type { View } from '../view';

interface Body {
  leg: Leg;
  actor: Actor;
  /** Atmosphere halo behind the disc, tinted to the body. */
  halo: Actor;
  /** Only the moon has one: the mast and pennant on its upper-left limb. */
  beacon?: Actor;
  /** Offset into every cycle, so no two bodies breathe or sway in step. */
  phase: number;
  swayRate: number;
  breatheRate: number;
}

/** Glow radius of `effects/star` at scale 1, from its generator (a softDisc of 6.5). */
const STAR_GLOW_R = 6.5;

/** Seconds per full rock, for the two ringed bodies. */
const ROCK_PERIOD = 11;

const DEG = Math.PI / 180;

/**
 * The outbound run: moon, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto.
 *
 * These are the things you *pass*, which is why they move and the finish line does
 * not. Each sits at a fixed point along the run and streams by with its own
 * parallax factor, so they read as bodies at different distances rather than a
 * row of stickers at the same depth.
 *
 * Sizes in the sheet are readable rather than physical (a real Jupiter beside a
 * real Pluto is a 59x spread). `scale` on top of that is how close you pass.
 *
 * Every body is a single static sprite, so all of its life is added here: a slow
 * axial turn, a breathing scale, a sideways drift, and a pulsing halo. Four small
 * cycles at four different rates, which is enough to stop a disc looking pasted on
 * without anything visibly animating.
 */
export class PlanetRun {
  private readonly _bodies: Body[] = [];
  private readonly _beaconAnim: Animation;

  constructor(scene: Scene, planets: Atlas, effects: Atlas) {
    this._beaconAnim = planets.animation('beacon');

    RUN.forEach((leg, i) => {
      const sprite = planets.sprite(leg.body);
      sprite.scale.setTo(leg.scale, leg.scale);

      const actor = new Actor({ name: leg.body, pos: vec(0, 0), z: Z.planets });
      actor.graphics.anchor = planets.anchorOf(leg.body);
      actor.graphics.use(sprite);
      scene.add(actor);

      // Sized off the atlas' own disc radius rather than the cell, since Saturn's
      // and Uranus' cells are mostly rings and a cell-sized halo would ring the
      // rings instead of the planet.
      const radius = (planets.json.radii?.[leg.body] ?? planets.frame(leg.body).w / 2) * leg.scale;
      const glow = effects.sprite('star');
      glow.tint = Color.fromHex(leg.glow);
      const glowScale = (radius * PLANET_HALO_SPAN) / STAR_GLOW_R;
      glow.scale.setTo(glowScale, glowScale);

      const halo = new Actor({ name: `${leg.body}Halo`, pos: vec(0, 0), z: Z.planets - 1 });
      halo.graphics.anchor = effects.anchorOf('star');
      halo.graphics.use(glow);
      scene.add(halo);

      const body: Body = {
        leg,
        actor,
        halo,
        phase: i * 2.399,
        swayRate: 0.17 + i * 0.021,
        breatheRate: 0.29 + i * 0.017,
      };

      if (leg.body === 'moon') {
        // Flavour, not a finish line any more: humanity got this far. It sits on
        // the moon's own cell, so the same position lines it up exactly, and it
        // takes the moon's rotation so the mast travels with the surface.
        this._beaconAnim.scale.setTo(leg.scale, leg.scale);
        const beacon = new Actor({ name: 'moonBeacon', pos: vec(0, 0), z: Z.planets + 1 });
        beacon.graphics.anchor = planets.anchorOf('beacon_0');
        beacon.graphics.use(this._beaconAnim);
        scene.add(beacon);
        body.beacon = beacon;
      }

      this._bodies.push(body);
    });
  }

  sync(view: View): void {
    for (const b of this._bodies) {
      const { leg } = b;
      // Level with the ship at `leg.at`, above it before, below it after.
      const y = view.shipY + (view.progress - leg.at) * PLANET_SPREAD * leg.depth;

      const half = (b.actor.graphics.current?.height ?? 0) / 2 + 80;
      const onScreen = y > -half && y < view.h + half;

      b.actor.graphics.visible = onScreen;
      b.halo.graphics.visible = onScreen;
      if (b.beacon) b.beacon.graphics.visible = onScreen;
      if (!onScreen) continue;

      const t = view.time;
      // Drift is scaled by depth, so a distant body sways less than a close one.
      const x = leg.x * view.w + Math.sin(t * b.swayRate + b.phase) * PLANET_SWAY * leg.depth;
      const breathe = 1 + Math.sin(t * b.breatheRate + b.phase) * PLANET_BREATHE;
      const rotation = leg.rock
        ? Math.sin((t / ROCK_PERIOD) * Math.PI * 2 + b.phase) * leg.spin * DEG
        : t * leg.spin * DEG;

      b.actor.pos.setTo(x, y);
      b.actor.scale.setTo(breathe, breathe);
      b.actor.rotation = rotation;

      // The halo breathes against the disc rather than with it, so the atmosphere
      // reads as glowing rather than as the whole sprite pumping.
      const haloScale = 2 - breathe;
      b.halo.pos.setTo(x, y);
      b.halo.scale.setTo(haloScale, haloScale);
      b.halo.graphics.opacity = PLANET_HALO_OPACITY * (0.82 + 0.18 * Math.sin(t * 0.63 + b.phase));

      if (b.beacon) {
        b.beacon.pos.setTo(x, y);
        b.beacon.scale.setTo(breathe, breathe);
        b.beacon.rotation = rotation;
      }
    }
  }
}
