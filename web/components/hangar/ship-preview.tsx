"use client";

import { TIER_LEN } from "@heliotyper/engine";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { type Clip, drawSprite, frameAt, type Sprite } from "@/game/atlas";
import { loadRocket } from "@/game/resources";
import type { Ship } from "@/lib/types";

/** The shared frame every rocket sheet is cut to, and the ship-centre anchor inside it. */
const FRAME = { w: 96, h: 176, ax: 48, ay: 52 };
/** CSS px per sprite px. */
const SCALE = 1.25;

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

/**
 * The selected ship, animated from its sprite sheet exactly as the race plays
 * it: a speed slider that walks the plume through every thrust tier, and a hull
 * breach toggle for the electrocution.
 */
export function ShipPreview({ ship }: { ship: Ship }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [speed, setSpeed] = useState(60);
  const [breach, setBreach] = useState(false);

  // The frame loop reads the controls through a ref, so moving the slider
  // changes the next frame instead of restarting the loop.
  const controls = useRef<Controls>({ speed, breach });
  useEffect(() => {
    controls.current = { speed, breach };
  }, [speed, breach]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(FRAME.w * SCALE * dpr);
    canvas.height = Math.round(FRAME.h * SCALE * dpr);
    ctx.setTransform(SCALE * dpr, 0, 0, SCALE * dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";

    // Held on the first frame of every clip, so the controls still work.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let disposed = false;

    // The game's own loader, so a sheet fetched here is already in hand for a race.
    loadRocket(ship.id)
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
        // The static card art above still shows the ship; there is nothing to animate.
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [ship.id]);

  const state = breach ? "during a hull breach" : speed > 0 ? `at ${speed}% speed` : "with its engines off";

  return (
    <div className="mb-4">
      <div
        className="grid h-64 place-items-center rounded-xl border border-line"
        style={{
          background: `radial-gradient(ellipse at 50% 72%, ${ship.exhaust.color}2e, transparent 66%), var(--color-well)`,
        }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${ship.name} ${state}`}
          className="animate-float"
          style={{ width: FRAME.w * SCALE, height: FRAME.h * SCALE }}
        />
      </div>

      <label className="mt-3 flex items-center gap-3">
        <span className="font-display text-xs font-semibold uppercase tracking-widest text-ink-dim">
          Speed
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="focus-ring min-w-0 flex-1"
          style={{ accentColor: ship.exhaust.color }}
        />
        <b className="w-10 text-right font-display text-sm tabular-nums">{speed}%</b>
      </label>

      <Button
        variant="ghost"
        size="sm"
        block
        aria-pressed={breach}
        onClick={() => setBreach((on) => !on)}
        // The arc colours from the zap sprite, so the button reads as the effect.
        className={breach ? "mt-3 border-[#38a8ff] text-[#a6f2ff]" : "mt-3"}
      >
        <span aria-hidden>↯</span> {breach ? "Stop hull breach" : "Hull breach"}
      </Button>
    </div>
  );
}
