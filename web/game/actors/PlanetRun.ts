import { type Atlas, type Clip, drawSprite, drawSpriteTransformed, frameAt, type Sprite } from '../atlas';
import {
  PLANET_BREATHE,
  PLANET_HALO_OPACITY,
  PLANET_HALO_SPAN,
  PLANET_SPREAD,
  PLANET_SWAY,
  RUN,
  type Leg,
} from '../config';
import { hexRgb } from '../util';
import type { View } from '../view';

interface Body {
  leg: Leg;
  sprite: Sprite;
  /** Atmosphere halo behind the disc, tinted to the body. */
  halo: Sprite;
  /** Draw scale that sizes the halo to this body's disc. */
  haloScale: number;
  /** Only the moon has one: the mast and pennant on its upper-left limb. */
  beacon?: Clip;
  /** Offset into every cycle, so no two bodies breathe or sway in step. */
  phase: number;
  swayRate: number;
  breatheRate: number;

  /** This frame's placement, shared by the halo, disc and beacon passes. */
  shown: boolean;
  x: number;
  y: number;
  breathe: number;
  rotation: number;
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

  constructor(planets: Atlas, effects: Atlas) {
    RUN.forEach((leg, i) => {
      // Sized off the atlas' own disc radius rather than the cell, since Saturn's
      // and Uranus' cells are mostly rings and a cell-sized halo would ring the
      // rings instead of the planet.
      const radius = (planets.json.radii?.[leg.body] ?? planets.frame(leg.body).w / 2) * leg.scale;

      this._bodies.push({
        leg,
        sprite: planets.sprite(leg.body),
        halo: effects.tinted('star', hexRgb(leg.glow)),
        haloScale: (radius * PLANET_HALO_SPAN) / STAR_GLOW_R,
        // Flavour, not a finish line any more: humanity got this far. It sits on
        // the moon's own cell, so it takes the moon's exact transform and the mast
        // travels with the surface.
        beacon: leg.body === 'moon' ? planets.clip('beacon') : undefined,
        phase: i * 2.399,
        swayRate: 0.17 + i * 0.021,
        breatheRate: 0.29 + i * 0.017,
        shown: false,
        x: 0,
        y: 0,
        breathe: 1,
        rotation: 0,
      });
    });
  }

  draw(ctx: CanvasRenderingContext2D, view: View): void {
    const t = view.time;

    for (const b of this._bodies) {
      const { leg } = b;
      // Level with the ship at `leg.at`, above it before, below it after.
      const y = view.shipY + (view.progress - leg.at) * PLANET_SPREAD * leg.depth;
      const half = (b.sprite.h * leg.scale) / 2 + 80;
      b.shown = y > -half && y < view.h + half;
      if (!b.shown) continue;

      // Drift is scaled by depth, so a distant body sways less than a close one.
      b.x = leg.x * view.w + Math.sin(t * b.swayRate + b.phase) * PLANET_SWAY * leg.depth;
      b.y = y;
      b.breathe = 1 + Math.sin(t * b.breatheRate + b.phase) * PLANET_BREATHE;
      b.rotation = leg.rock
        ? Math.sin((t / ROCK_PERIOD) * Math.PI * 2 + b.phase) * leg.spin * DEG
        : t * leg.spin * DEG;
    }

    ctx.save();

    // Every halo goes down before any disc. The halos are wide enough to reach a
    // neighbouring body, and one drawn over a disc would wash it out.
    for (const b of this._bodies) {
      if (!b.shown) continue;
      // The halo breathes against the disc rather than with it, so the atmosphere
      // reads as glowing rather than as the whole sprite pumping.
      ctx.globalAlpha = PLANET_HALO_OPACITY * (0.82 + 0.18 * Math.sin(t * 0.63 + b.phase));
      drawSprite(ctx, b.halo, b.x, b.y, b.haloScale * (2 - b.breathe));
    }
    ctx.globalAlpha = 1;

    for (const b of this._bodies) {
      if (!b.shown) continue;
      const s = b.leg.scale * b.breathe;
      drawSpriteTransformed(ctx, b.sprite, b.x, b.y, s, s, b.rotation);
    }

    for (const b of this._bodies) {
      if (!b.shown || !b.beacon) continue;
      const s = b.leg.scale * b.breathe;
      drawSpriteTransformed(ctx, frameAt(b.beacon, t), b.x, b.y, s, s, b.rotation);
    }

    ctx.restore();
  }
}
