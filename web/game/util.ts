import { SKY_KEYS } from './config';

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

export const randInt = (loInclusive: number, hiExclusive: number): number =>
  loInclusive + Math.floor(Math.random() * (hiExclusive - loInclusive));

/** Ease a value toward a target at a frame-rate independent rate. */
export const approach = (current: number, target: number, rate: number, dt: number): number =>
  current + (target - current) * clamp(rate * dt, 0, 1);

/**
 * The two stop colours of the sky gradient at a given point in the climb.
 *
 * One gradient, lerped stops. See SKY_KEYS.
 */
export function skyColors(t: number): { top: string; bot: string } {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && t > SKY_KEYS[i + 1].at) i++;
  const a = SKY_KEYS[i];
  const b = SKY_KEYS[i + 1];
  const k = clamp((t - a.at) / (b.at - a.at), 0, 1);
  const mix = (u: number, v: number) => Math.round(lerp(u, v, k));
  return {
    top: `rgb(${mix(a.top[0], b.top[0])},${mix(a.top[1], b.top[1])},${mix(a.top[2], b.top[2])})`,
    bot: `rgb(${mix(a.bot[0], b.bot[0])},${mix(a.bot[1], b.bot[1])},${mix(a.bot[2], b.bot[2])})`,
  };
}
