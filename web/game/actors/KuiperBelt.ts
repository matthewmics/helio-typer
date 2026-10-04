import { makeRng } from '@heliotyper/engine';
import { type Atlas, drawSprite, drawSpriteTransformed, type Sprite } from '../atlas';
import { KUIPER, KUIPER_NAMED, PLANET_SPREAD } from '../config';
import { clamp, lerp, type Rgb } from '../util';
import type { View } from '../view';

interface Rock {
  sprite: Sprite;
  /** Progress at which it is level with the ship. */
  at: number;
  /** Horizontal position as a fraction of the viewport width. */
  x: number;
  /** Parallax factor, as for the planets. Over 1 is nearer than the rockets. */
  depth: number;
  scale: number;
  alpha: number;
  /** Where in its tumble it starts, in radians, and how fast it turns. */
  angle: number;
  spin: number;
  /** Half its cell at this scale, so it is never culled while any of it shows. */
  half: number;
}

interface Speck {
  sprite: Sprite;
  at: number;
  x: number;
  depth: number;
  scale: number;
  alpha: number;
}

/** Dust in the belt's own reds, greys and ice, washed out by distance. */
const DUST_TINTS: readonly Rgb[] = [
  [214, 178, 156],
  [196, 190, 186],
  [200, 212, 226],
];

/**
 * How far before the belt any of it can be on screen, in progress. The furthest
 * layer moves slowest and so shows up earliest; past this, drawing is skipped.
 */
const LEAD = 0.25;

const DEG = Math.PI / 180;

/**
 * The Kuiper belt: a field of icy bodies streaming past through the stretch of
 * the run beyond Neptune.
 *
 * Every other landmark is one body at one point on the run. The belt is a field,
 * so it is built the way the clouds are: many copies of a small kit of sprites,
 * each at its own place along the run, its own depth and its own size, so it
 * reads as volume rather than as a pattern. Placement is the planets' own
 * (`PLANET_SPREAD` times depth), which keeps the belt in the same world as
 * Pluto, which sits inside it.
 *
 * Three layers, nearest last: dust too small to make out, pebbles, and rocks
 * that tumble as they pass. A few rocks are passed so close that they go in
 * front of the rockets, the trick the clouds use to sell depth, and those keep
 * to the sides so they never cross your own ship.
 *
 * The layout is seeded, so the belt is the same place in every race.
 */
export class KuiperBelt {
  private readonly _dust: Speck[] = [];
  /** Pebbles and rocks behind the rockets, furthest first so nearer ones draw over them. */
  private readonly _behind: Rock[] = [];
  private readonly _front: Rock[] = [];

  constructor(kuiper: Atlas, effects: Atlas) {
    const rnd = makeRng(KUIPER.seed);
    const between = (lo: number, hi: number): number => lo + rnd() * (hi - lo);
    const pick = <T>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
    // Thicker through the middle than at either end, so the belt thins in and
    // out rather than starting and stopping like a wall.
    const along = (): number => KUIPER.from + ((rnd() + rnd()) / 2) * (KUIPER.to - KUIPER.from);
    const turn = (lo: number, hi: number): number => between(lo, hi) * DEG * (rnd() < 0.5 ? -1 : 1);

    const rock = (frame: string, r: Omit<Rock, 'sprite' | 'half' | 'angle'>): Rock => {
      const sprite = kuiper.sprite(frame);
      return { ...r, sprite, angle: rnd() * Math.PI * 2, half: (Math.max(sprite.w, sprite.h) * r.scale) / 2 };
    };

    const dust = DUST_TINTS.map((rgb) => effects.tinted('star', rgb));
    for (let i = 0; i < KUIPER.dust; i++) {
      // The star sprite is pure halo under about a quarter scale, and vanishes.
      this._dust.push({
        sprite: pick(dust),
        at: along(),
        x: rnd(),
        depth: between(0.5, 0.95),
        scale: between(0.25, 0.42),
        alpha: between(0.22, 0.55),
      });
    }

    const pebbles = kuiper.json.pebbles ?? [];
    for (let i = 0; i < KUIPER.pebbles && pebbles.length > 0; i++) {
      const depth = between(0.45, 0.9);
      this._behind.push(
        rock(pick(pebbles), {
          at: along(),
          x: rnd(),
          depth,
          scale: lerp(0.55, 1, (depth - 0.45) / 0.45) * between(0.8, 1.2),
          alpha: nearness(depth),
          spin: turn(10, 50),
        }),
      );
    }

    const bodies = kuiper.json.bodies ?? [];
    for (let i = 0; i < KUIPER.rocks && bodies.length > 0; i++) {
      const depth = between(0.45, 0.95);
      this._behind.push(
        rock(pick(bodies), {
          at: along(),
          x: rnd(),
          depth,
          // Nearer is bigger as well as faster: the two together are what read
          // as depth, and either one alone looks like a mistake.
          scale: lerp(0.3, 0.72, (depth - 0.45) / 0.5) * between(0.8, 1.2),
          alpha: nearness(depth),
          // Slow, because the light is baked in and turns with the rock.
          spin: turn(3, 14),
        }),
      );
    }

    for (const n of KUIPER_NAMED) {
      this._behind.push(
        rock(n.frame, { at: n.at, x: n.x, depth: n.depth, scale: n.scale, alpha: 1, spin: n.spin * DEG }),
      );
    }
    this._behind.sort((a, b) => a.depth - b.depth);

    for (let i = 0; i < KUIPER.near && bodies.length > 0; i++) {
      this._front.push(
        rock(pick(bodies), {
          at: between(KUIPER.from + 0.01, KUIPER.to - 0.01),
          // Off to one side or the other, never down the middle where you fly.
          x: rnd() < 0.5 ? between(0.03, 0.27) : between(0.73, 0.97),
          depth: between(1.15, 1.55),
          scale: between(0.85, 1.3),
          alpha: 1,
          spin: turn(6, 18),
        }),
      );
    }
  }

  /** Dust, pebbles and rocks: everything the rockets fly in front of. */
  drawBehind(ctx: CanvasRenderingContext2D, view: View): void {
    if (view.progress < KUIPER.from - LEAD) return;

    ctx.save();
    for (const s of this._dust) {
      const y = placeY(view, s.at, s.depth);
      if (y < -4 || y > view.h + 4) continue;
      ctx.globalAlpha = s.alpha;
      drawSprite(ctx, s.sprite, s.x * view.w, y, s.scale);
    }
    this._drawRocks(ctx, view, this._behind);
    ctx.restore();
  }

  /** The few rocks passed close enough to go in front of the rockets. */
  drawInFront(ctx: CanvasRenderingContext2D, view: View): void {
    if (view.progress < KUIPER.from - LEAD) return;

    ctx.save();
    this._drawRocks(ctx, view, this._front);
    ctx.restore();
  }

  private _drawRocks(ctx: CanvasRenderingContext2D, view: View, rocks: readonly Rock[]): void {
    for (const r of rocks) {
      const y = placeY(view, r.at, r.depth);
      if (y < -r.half || y > view.h + r.half) continue;
      ctx.globalAlpha = r.alpha;
      drawSpriteTransformed(ctx, r.sprite, r.x * view.w, y, r.scale, r.scale, r.angle + view.time * r.spin);
    }
  }
}

/** Level with the ship at `at`, above it before and below it after, exactly as the planets. */
function placeY(view: View, at: number, depth: number): number {
  return view.shipY + (view.progress - at) * PLANET_SPREAD * depth;
}

/** Further is fainter: a far rock catches less of a sun that is already a star. */
function nearness(depth: number): number {
  return lerp(0.55, 1, clamp((depth - 0.45) / 0.5, 0, 1));
}
