import { type Atlas, type Clip, drawSprite, drawSpriteTransformed, frameAt, type Sprite } from '../atlas';
import { hexRgb, rand, randInt } from '../util';

/** The smoke texture is a 96px cell whose puff fills most of it. */
const SMOKE_RADIUS = 44;

const SMOKE_POOL = 72;

/**
 * How many launch-smoke greys to tint up front. Each puff picks one at random,
 * which across a 54-puff cloud reads exactly like a fresh colour per puff without
 * tinting a new texture every time.
 */
const SMOKE_TINTS = 8;

const SPARK_LIFE = 0.75;
const SPARK_SCALE = 0.4;
/** px/s², pulling sparks down as they scatter. */
const SPARK_GRAVITY = 130;

const SPARK_COLOURS = ['#ffd98a', '#ff9d4d'];

interface Puff {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  /** Current radius in px. */
  size: number;
  /** Radius growth per second: smoke billows outward as it dissipates. */
  grow: number;
}

interface Spark {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  rotation: number;
}

/**
 * One-shot effects: the blastoff cloud, ignition and mistake sparks, and the hull
 * breach burst.
 */
export class Effects {
  /** Every smoke shape in every launch grey. */
  private readonly _smoke: Sprite[] = [];
  private readonly _puffs: Puff[] = [];
  private readonly _sparkSprites: Sprite[];
  private readonly _sparks: Spark[] = [];

  private readonly _breach: Clip;
  /** Clock time the breach burst started, or null when none is playing. */
  private _breachAt: number | null = null;
  private _breachX = 0;
  private _breachY = 0;

  private _clock = 0;

  constructor(fx: Atlas) {
    for (let i = 0; i < SMOKE_TINTS; i++) {
      const grey = [randInt(118, 192), randInt(112, 186), randInt(126, 200)] as const;
      for (let shape = 0; shape < 4; shape++) this._smoke.push(fx.tinted(`smoke_${shape}`, grey));
    }
    for (let i = 0; i < SMOKE_POOL; i++) {
      this._puffs.push({ sprite: this._smoke[0], x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 0, grow: 0 });
    }

    this._sparkSprites = SPARK_COLOURS.map((hex) => fx.tinted('spark', hexRgb(hex)));

    // The breach is the one-shot at the moment hull hits zero. The rockets' own
    // `zap` covers the sustained stall that follows, so the two play in sequence.
    this._breach = fx.clip('breach');
  }

  /**
   * Ignition: a billowing exhaust cloud that rolls outward across the pad, plus a
   * shower of sparks underneath the ship.
   */
  launch(x: number, y: number): void {
    for (let i = 0; i < 54; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(70, 270);
      this._spawnPuff({
        x: x + rand(-18, 18),
        y: y + rand(-7, 7),
        vx: Math.cos(a) * s,
        // Biased outward and slightly down: the cloud rolls across the deck.
        vy: Math.abs(Math.sin(a)) * s * 0.32 + 18,
        life: rand(0.9, 1.9),
        size: rand(9, 24),
        grow: 28,
      });
    }
    this._emitSparks(x, y, 13);
  }

  /** Mistake: a short spark scatter off the hull. */
  mistake(x: number, y: number): void {
    this._emitSparks(x, y, 5);
  }

  /** Hull breach: white-out flash, shock ring, then the stall's zap takes over. */
  breach(x: number, y: number): void {
    this._breachAt = this._clock;
    this._breachX = x;
    this._breachY = y;
    this._emitSparks(x, y, 9);
  }

  /** Wipe every live effect, for a restart. */
  clear(): void {
    for (const p of this._puffs) p.life = 0;
    this._sparks.length = 0;
    this._breachAt = null;
  }

  update(dt: number): void {
    this._clock += dt;

    // Per-frame drag of 0.96 at 60fps, expressed so it does not change with frame rate.
    const drag = Math.pow(0.96, dt * 60);
    for (const p of this._puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
      p.size += p.grow * dt;
    }

    let live = 0;
    for (const s of this._sparks) {
      s.life -= dt;
      if (s.life <= 0) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt + 0.5 * SPARK_GRAVITY * dt * dt;
      s.vy += SPARK_GRAVITY * dt;
      this._sparks[live++] = s;
    }
    this._sparks.length = live;

    if (this._breachAt !== null && this._clock - this._breachAt >= this._breach.duration) {
      this._breachAt = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (const p of this._puffs) {
      if (p.life <= 0) continue;
      ctx.globalAlpha = p.life / p.maxLife;
      drawSprite(ctx, p.sprite, p.x, p.y, p.size / SMOKE_RADIUS);
    }
    ctx.globalAlpha = 1;

    if (this._breachAt !== null) {
      drawSprite(ctx, frameAt(this._breach, this._clock - this._breachAt), this._breachX, this._breachY);
    }

    for (const s of this._sparks) {
      ctx.globalAlpha = s.life / SPARK_LIFE;
      drawSpriteTransformed(ctx, s.sprite, s.x, s.y, SPARK_SCALE, SPARK_SCALE, s.rotation);
    }

    ctx.restore();
  }

  /**
   * Scatter sparks from (x, y), `perColour` of each colour.
   *
   * Each one starts somewhere inside a 5px disc along its own heading, flies
   * outward at a random speed, falls, and fades out over its life.
   */
  private _emitSparks(x: number, y: number, perColour: number): void {
    for (const sprite of this._sparkSprites) {
      for (let i = 0; i < perColour; i++) {
        const heading = Math.random() * Math.PI * 2;
        const speed = rand(90, 310);
        const offset = rand(0, 5);
        this._sparks.push({
          sprite,
          x: x + Math.cos(heading) * offset,
          y: y + Math.sin(heading) * offset,
          vx: Math.cos(heading) * speed,
          vy: Math.sin(heading) * speed,
          life: SPARK_LIFE,
          rotation: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  private _spawnPuff(o: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    size: number;
    grow: number;
  }): void {
    const p = this._puffs.find((c) => c.life <= 0);
    if (!p) return; // pool exhausted: dropping a puff beats stalling the frame

    p.sprite = this._smoke[randInt(0, this._smoke.length)];
    p.x = o.x;
    p.y = o.y;
    p.vx = o.vx;
    p.vy = o.vy;
    p.life = o.life;
    p.maxLife = o.life;
    p.size = o.size;
    p.grow = o.grow;
  }
}
