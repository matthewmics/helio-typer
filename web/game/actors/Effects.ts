import {
  Actor,
  type Animation,
  AnimationStrategy,
  Color,
  EmitterType,
  ParticleEmitter,
  ParticleTransform,
  type Scene,
  type Sprite,
  vec,
} from 'excalibur';
import type { Atlas } from '../atlas';
import { Z } from '../config';
import { rand, randInt } from '../util';

/** The smoke texture is a 96px cell whose puff fills most of it. */
const SMOKE_RADIUS = 44;

const SMOKE_POOL = 72;

interface Puff {
  actor: Actor;
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  /** Current radius in px. */
  size: number;
  /** Radius growth per second: smoke billows outward as it dissipates. */
  grow: number;
}

/**
 * One-shot effects: the blastoff cloud, ignition and mistake sparks, and the hull
 * breach burst.
 *
 * Sparks run on Excalibur's {@link ParticleEmitter}, which fits them exactly.
 * The launch smoke does not: in 0.32 a particle with a `graphic` renders that
 * graphic at its natural size and ignores the per-particle size, growth and colour
 * fields, so the billow that makes the launch cloud read would be lost. That gets
 * its own small pool instead.
 */
export class Effects {
  private readonly _puffs: Puff[] = [];
  private readonly _sparksWarm: ParticleEmitter;
  private readonly _sparksAmber: ParticleEmitter;
  private readonly _breach: Actor;
  private readonly _breachAnim: Animation;

  constructor(scene: Scene, fx: Atlas) {
    const smokeAnchor = fx.anchorOf('smoke_0');
    for (let i = 0; i < SMOKE_POOL; i++) {
      const shape = randInt(0, 4);
      const sprite = fx.sprite(`smoke_${shape}`);
      const actor = new Actor({ name: `puff${i}`, pos: vec(0, 0), z: Z.effects });
      actor.graphics.anchor = smokeAnchor;
      actor.graphics.use(sprite);
      actor.graphics.visible = false;
      scene.add(actor);
      this._puffs.push({ actor, sprite, vx: 0, vy: 0, life: 0, maxLife: 1, size: 0, grow: 0 });
    }

    this._sparksWarm = Effects._sparkEmitter(fx, '#ffd98a');
    this._sparksAmber = Effects._sparkEmitter(fx, '#ff9d4d');
    scene.add(this._sparksWarm);
    scene.add(this._sparksAmber);

    // The breach is the one-shot at the moment hull hits zero. The rockets' own
    // `zap` covers the sustained stall that follows, so the two play in sequence.
    this._breachAnim = fx.animation('breach', { strategy: AnimationStrategy.End });
    this._breach = new Actor({ name: 'breach', pos: vec(0, 0), z: Z.effects });
    this._breach.graphics.anchor = fx.anchorOf('breach_0');
    this._breach.graphics.use(this._breachAnim);
    this._breach.graphics.visible = false;
    scene.add(this._breach);
  }

  private static _sparkEmitter(fx: Atlas, color: string): ParticleEmitter {
    const sprite = fx.sprite('spark');
    sprite.tint = Color.fromHex(color);
    sprite.scale.setTo(0.4, 0.4);

    return new ParticleEmitter({
      pos: vec(0, 0),
      z: Z.effects,
      isEmitting: false,
      emitRate: 0,
      emitterType: EmitterType.Circle,
      radius: 5,
      particle: {
        transform: ParticleTransform.Global,
        graphic: sprite,
        life: 750,
        fade: true,
        minSpeed: 90,
        maxSpeed: 310,
        minAngle: 0,
        maxAngle: Math.PI * 2,
        acc: vec(0, 130),
        randomRotation: true,
        z: Z.effects,
      },
    });
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
        tint: Color.fromRGB(randInt(118, 192), randInt(112, 186), randInt(126, 200)),
      });
    }
    this._sparks(x, y, 13);
  }

  /** Mistake: a short spark scatter off the hull. */
  mistake(x: number, y: number): void {
    this._sparks(x, y, 5);
  }

  /** Hull breach: white-out flash, shock ring, then the stall's zap takes over. */
  breach(x: number, y: number): void {
    this._breach.pos.setTo(x, y);
    this._breach.graphics.visible = true;
    this._breachAnim.reset();
    this._breachAnim.play();
    this._sparks(x, y, 9);
  }

  private _sparks(x: number, y: number, perEmitter: number): void {
    this._sparksWarm.pos.setTo(x, y);
    this._sparksAmber.pos.setTo(x, y);
    this._sparksWarm.emitParticles(perEmitter);
    this._sparksAmber.emitParticles(perEmitter);
  }

  private _spawnPuff(o: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    size: number;
    grow: number;
    tint: Color;
  }): void {
    const p = this._puffs.find((c) => c.life <= 0);
    if (!p) return; // pool exhausted: dropping a puff beats stalling the frame

    p.vx = o.vx;
    p.vy = o.vy;
    p.life = o.life;
    p.maxLife = o.life;
    p.size = o.size;
    p.grow = o.grow;
    p.sprite.tint = o.tint;
    p.actor.pos.setTo(o.x, o.y);
    p.actor.graphics.visible = true;
  }

  update(dt: number): void {
    // Per-frame drag of 0.96 at 60fps, expressed so it does not change with frame rate.
    const drag = Math.pow(0.96, dt * 60);

    for (const p of this._puffs) {
      if (p.life <= 0) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.actor.graphics.visible = false;
        continue;
      }

      p.actor.pos.x += p.vx * dt;
      p.actor.pos.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
      p.size += p.grow * dt;

      const s = p.size / SMOKE_RADIUS;
      p.sprite.scale.setTo(s, s);
      p.actor.graphics.opacity = Math.max(0, p.life / p.maxLife);
    }

    if (this._breach.graphics.visible && this._breachAnim.done) {
      this._breach.graphics.visible = false;
    }
  }

  /** Wipe every live effect, for a restart. */
  clear(): void {
    for (const p of this._puffs) {
      p.life = 0;
      p.actor.graphics.visible = false;
    }
    this._sparksWarm.clearParticles();
    this._sparksAmber.clearParticles();
    this._breach.graphics.visible = false;
  }
}
