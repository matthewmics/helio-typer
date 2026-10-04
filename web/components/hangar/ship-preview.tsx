"use client";

import { useState } from "react";
import { ShipAnimation } from "@/components/ship-animation";
import { Button } from "@/components/ui/button";
import type { Ship } from "@/lib/types";

/**
 * The selected ship, animated as the race plays it: a speed slider that walks
 * the plume through every thrust tier, and a hull breach toggle for the
 * electrocution.
 */
export function ShipPreview({ ship }: { ship: Ship }) {
  const [speed, setSpeed] = useState(60);
  const [breach, setBreach] = useState(false);

  const state = breach ? "during a hull breach" : speed > 0 ? `at ${speed}% speed` : "with its engines off";

  return (
    <div className="mb-4">
      <div
        className="grid h-64 place-items-center rounded-xl border border-line"
        style={{
          background: `radial-gradient(ellipse at 50% 72%, ${ship.exhaust.color}2e, transparent 66%), var(--color-well)`,
        }}
      >
        <ShipAnimation
          id={ship.id}
          speed={speed}
          breach={breach}
          label={`${ship.name} ${state}`}
          className="animate-float"
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
