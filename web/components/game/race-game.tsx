"use client";

import { useEffect, useRef, useState } from "react";
import { RaceHud } from "./race-hud";
import "./race-game.css";

type Status = { kind: "booting" } | { kind: "running" } | { kind: "failed"; message: string };

/**
 * Boots the Excalibur engine onto a canvas this component owns.
 *
 * Everything Excalibur touches is loaded inside the effect rather than imported
 * at module scope. The engine reaches for `window` and `document` as it is
 * constructed, so a static import would be evaluated during server rendering and
 * the route would fail before it ever reached a browser.
 */
export function RaceGame({ seed }: { seed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "booting" });

  useEffect(() => {
    // Guards the async boot below. React remounts this component on every save
    // in development, and StrictMode mounts it twice on purpose, so by the time
    // the dynamic imports resolve this effect may already have been torn down.
    let cancelled = false;
    let engine: import("excalibur").Engine | null = null;
    let scene: import("@/game/scenes/RaceScene").RaceScene | null = null;

    void (async () => {
      try {
        const [excalibur, { RaceScene }, resources] = await Promise.all([
          import("excalibur"),
          import("@/game/scenes/RaceScene"),
          import("@/game/resources"),
        ]);

        // Atlas JSON has to be in hand before the scene initialises: the scene
        // calls atlases() synchronously and there is nowhere left to await.
        await resources.loadAtlasData();

        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;

        // The resolution is fixed and the display mode fits it to the screen
        // while filling any leftover space, so the 1280x720 frame is always
        // fully visible and a wider window just sees more sky. Every layout
        // constant can therefore stay a plain number rather than a fraction of
        // an unknown viewport.
        engine = new excalibur.Engine({
          canvasElement: canvas,
          resolution: { width: 1280, height: 720 },
          displayMode: excalibur.DisplayMode.FitScreenAndFill,
          backgroundColor: excalibur.Color.fromHex("#05060a"),
          // The art is anti-aliased software-rastered output, not pixel art.
          antialiasing: true,
          pixelArt: false,
          suppressPlayButton: true,
          // Typing is read straight off the DOM keydown event, so Excalibur does
          // not need to swallow keys of its own.
          suppressConsoleBootMessage: true,
        });

        // A solo run rolls its own seed. A match hands one down so every pilot
        // in it walks the same sentence list.
        scene = new RaceScene(seed ?? Math.floor(Math.random() * 1e9));
        engine.addScene("race", scene);
        await engine.start("race", { loader: resources.createLoader() });

        if (cancelled) return;
        setStatus({ kind: "running" });
      } catch (err) {
        if (cancelled) return;
        setStatus({ kind: "failed", message: (err as Error).message });
      }
    })();

    return () => {
      cancelled = true;
      // Order matters. The scene's window listener has to come off first, or a
      // discarded race keeps receiving keystrokes after its engine is gone.
      scene?.detach();
      engine?.stop();
      engine?.dispose();
    };
  }, [seed]);

  return (
    <div className="race-root">
      <canvas ref={canvasRef} />
      <RaceHud />

      {status.kind === "booting" && (
        <div className="race-status">
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
    </div>
  );
}
