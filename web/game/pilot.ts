import type { Phase, Race } from '@heliotyper/engine';

/**
 * Everything the renderer needs to draw one rocket, local or remote.
 *
 * The `Rocket` actor used to take a `Race` directly, which only worked while the
 * only rocket on screen was the one this browser was simulating. A remote pilot
 * has no `Race` here: all that arrives is interpolated snapshot state. Both sides
 * produce this shape instead, so one actor draws either.
 */
export interface PilotView {
  launched: boolean;
  launchT: number;
  speed: number;
  speedRatio: number;
  tier: number;
  phase: Phase;
  hull: number;
  maxHull: number;
  progress: number;
}

/** The local pilot's own simulation, in the shape the renderer wants. */
export function viewOfRace(race: Race): PilotView {
  return {
    launched: race.launched,
    launchT: race.launchT,
    speed: race.speed,
    speedRatio: race.speedRatio,
    tier: race.tier,
    phase: race.phase,
    hull: race.hull,
    maxHull: race.cfg.maxHull,
    progress: race.progress,
  };
}
