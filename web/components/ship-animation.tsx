"use client";

import { TIER_LEN } from "@heliotyper/engine";
import { useEffect, useRef } from "react";
import { type Clip, drawSprite, frameAt, type Sprite } from "@/game/atlas";
import { loadRocket, type RocketId } from "@/game/resources";

/** The shared frame every rocket sheet is cut to, and the ship-centre anchor inside it. */
const FRAME = { w: 96, h: 176, ax: 48, ay: 52 };

type RocketArt = { ship: Sprite; thrust: Clip[]; zap: Clip };

type Controls = { speed: number; breach: boolean };

/**
 * Thruster, hull, zap: the race's own draw order. A breached ship is stalled at
 * zero speed in a race, so it shows no plume here either.
 */
function draw(ctx: CanvasRenderingContext2D, art: RocketArt, t: number, { speed, breach }: Controls) {
  ctx.clearRect(0, 0, FRAME.w, FRAME.h);
  if (!breach && speed > 0) {
    // The engine's own bucketing of speed into plume tiers.
    const tier = Math.min(art.thrust.length - 1, Math.floor((speed / 100) * art.thrust.length));
    drawSprite(ctx, frameAt(art.thrust[tier], t), FRAME.ax, FRAME.ay);
  }
  drawSprite(ctx, art.ship, FRAME.ax, FRAME.ay);
  if (breach) drawSprite(ctx, frameAt(art.zap, t), FRAME.ax, FRAME.ay);
}

export type ShipAnimationProps = {
  id: RocketId;
  /** 0 to 100. Zero is engines off; anything else picks the plume's thrust tier. */
  speed: number;
  /** Swap the plume for the electrocution, as a stalled ship looks in a race. */
  breach?: boolean;
  /** CSS px per sprite px. */
  scale?: number;
  /** What the ship is doing, for screen readers. Without one it is decoration. */
  label?: string;
  className?: string;
};

/** One rocket, animated from its sprite sheet exactly as the race plays it. */
export function ShipAnimation({
  id,
  speed,
  breach = false,
  scale = 1.25,
  label,
  className,
}: ShipAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The frame loop reads these through a ref, so changing them changes the
  // next frame instead of restarting the loop.
  const controls = useRef<Controls>({ speed, breach });
  useEffect(() => {
    controls.current = { speed, breach };
  }, [speed, breach]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(FRAME.w * scale * dpr);
    canvas.height = Math.round(FRAME.h * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";

    // Held on the first frame of every clip, so the controls still work.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let disposed = false;

    // The game's own loader, so a sheet fetched here is already in hand for a race.
    loadRocket(id)
      .then((atlas) => {
        if (disposed) return;
        const art: RocketArt = {
          ship: atlas.sprite("ship"),
          thrust: TIER_LEN.map((_, i) => atlas.clip(`thrust_t${i}`)),
          zap: atlas.clip("zap"),
        };
        const start = performance.now();
        const tick = (now: number) => {
          draw(ctx, art, still ? 0 : (now - start) / 1000, controls.current);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {
        // Nothing to animate. Whatever surrounds the canvas has to carry the ship.
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [id, scale]);

  return (
    <canvas
      ref={canvasRef}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={{ width: FRAME.w * scale, height: FRAME.h * scale }}
    />
  );
}
