"use client";

import { useEffect, useRef, useState } from "react";
import type { RaceNetClient } from "@/game/net";
import { loadArt } from "@/game/resources";
import { RaceScene, type RunResult } from "@/game/scenes/RaceScene";
import type { ResultRow } from "@/lib/race/use-race-connection";
import { FinishModal } from "./finish-modal";
import { RaceHud } from "./race-hud";
import "./race-game.css";

type Status = { kind: "booting" } | { kind: "running" } | { kind: "failed"; message: string };

export type RaceGameProps = {
  /** Shared by the whole lobby. A solo run rolls its own. */
  seed: number;
  /** Callsign on your own name pill. */
  youName: string;
  /** Absent for a solo run, in which case the field is just you. */
  net?: RaceNetClient;
  /** Final standings, once the server has closed the race. */
  final?: ResultRow[] | null;
};

/**
 * Runs the race on a canvas this component owns.
 *
 * No engine and no splash screen: the art is fetched, the scene is built, and the
 * first frame drawn is the launch pad. Nothing in `@/game` touches the browser
 * until the effect below calls into it, which is what keeps these imports safe
 * during server rendering.
 */
export function RaceGame({ seed, youName, net, final = null }: RaceGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RaceScene | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "booting" });
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    // React remounts this component on every save in development, and StrictMode
    // mounts it twice on purpose, so the art can arrive after this effect has
    // already been torn down.
    let cancelled = false;
    let scene: RaceScene | null = null;

    loadArt()
      .then((art) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        setResult(null);
        scene = new RaceScene(canvas, art, { seed, youName, net, onFinish: setResult });
        sceneRef.current = scene;
        setStatus({ kind: "running" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus({ kind: "failed", message: err instanceof Error ? err.message : String(err) });
      });

    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [seed, youName, net]);

  const flyAgain = () => {
    sceneRef.current?.restart();
    setResult(null);
  };

  return (
    <div className="race-root">
      <canvas ref={canvasRef} />
      <RaceHud />

      {status.kind === "booting" && (
        <div className="race-status is-booting">
          <p>Loading the launch pad...</p>
        </div>
      )}

      {status.kind === "failed" && (
        <div className="race-status">
          <p>The game could not start.</p>
          <code>{status.message}</code>
          <p>
            If the sprite sheets are missing, run <code>pnpm --filter web sync:assets</code>.
          </p>
        </div>
      )}

      {/* Opens the moment you cross, or when the race closes without you. */}
      {(result || final) && (
        <FinishModal
          result={result}
          net={net}
          final={final}
          onFlyAgain={net ? undefined : flyAgain}
        />
      )}
    </div>
  );
}
