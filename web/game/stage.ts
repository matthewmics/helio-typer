/**
 * The canvas, fitted to the window, plus the frame loop and screen shake.
 *
 * This is all of an engine the game needs. Sizing works the way Excalibur's
 * `FitScreenAndFill` mode did, which the run was tuned under: the 1280x720 frame
 * always fits entirely on screen, and any space left over shows more of the world
 * rather than letterboxing, so a wider window just sees more sky. That is what
 * lets every layout constant in config.ts stay a plain number of px rather than a
 * fraction of an unknown viewport.
 *
 * There is no camera. It never moves (rules/game-presentation.md), so world space
 * is screen space and the only transform is the fit scale plus the shake.
 */

/** The frame every layout constant is written against. */
const FRAME_W = 1280;
const FRAME_H = 720;

/** Painted under everything, every frame. */
const BACKGROUND = '#05060a';

/**
 * Cap on canvas pixels per CSS px. Past 2 the extra resolution costs fill rate on
 * every layer without visibly sharpening art authored at 1x.
 */
const MAX_PIXEL_RATIO = 2;

export class Stage {
  readonly ctx: CanvasRenderingContext2D;
  /** Drawable width in world px: 1280, or more when the window is wider than 16:9. */
  width = FRAME_W;
  /** Drawable height in world px: 720, or more when the window is taller than 16:9. */
  height = FRAME_H;

  private readonly _canvas: HTMLCanvasElement;
  private _onFrame: ((dt: number) => void) | null = null;

  private _cssW = 0;
  private _cssH = 0;
  private _pixelRatio = 0;
  /** Canvas px per world px. */
  private _scale = 1;

  private _shakeMagnitude = 0;
  private _shakeLeftMs = 0;
  private _shakeX = 0;
  private _shakeY = 0;

  private _raf = 0;
  private _lastTime: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // Opaque, since every frame paints the whole canvas: the browser can skip
    // blending it with the page underneath.
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('this browser cannot draw a 2D canvas');
    this._canvas = canvas;
    this.ctx = ctx;
    this._fit();
  }

  /**
   * Start the frame loop. `onFrame` is handed the seconds since the previous
   * frame, with the context already set up to draw in world px.
   */
  start(onFrame: (dt: number) => void): void {
    this._onFrame = onFrame;
    this._raf = requestAnimationFrame(this._tick);
  }

  /**
   * Jolt the frame for `durationMs`. A new shake replaces any that is running.
   *
   * The offset is re-rolled every frame, in whole px. It is the same jitter
   * Excalibur's camera shake produced, but centred on zero rather than always
   * pushing the frame down and to the right.
   */
  shake(magnitude: number, durationMs: number): void {
    this._shakeMagnitude = magnitude;
    this._shakeLeftMs = durationMs;
  }

  dispose(): void {
    cancelAnimationFrame(this._raf);
  }

  private readonly _tick = (now: number): void => {
    // Scheduled before the frame runs, so a dispose() from inside it still cancels.
    this._raf = requestAnimationFrame(this._tick);
    const elapsedMs = this._lastTime === null ? 0 : now - this._lastTime;
    this._lastTime = now;

    this._fit();
    this._advanceShake(elapsedMs);

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    // From here on, everything draws in world px.
    const k = this._scale;
    ctx.setTransform(k, 0, 0, k, this._shakeX * k, this._shakeY * k);

    this._onFrame?.(elapsedMs / 1000);
  };

  /**
   * Match the canvas to its laid-out size and the screen's pixel density.
   *
   * Polled every frame instead of wired to resize events, because the density can
   * change with no resize event at all, for instance when the window is dragged to
   * another monitor. Reading the size at the top of a frame, before the HUD has
   * written anything to the DOM, costs nothing.
   */
  private _fit(): void {
    const cssW = this._canvas.clientWidth;
    const cssH = this._canvas.clientHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    if (cssW === this._cssW && cssH === this._cssH && pixelRatio === this._pixelRatio) return;
    this._cssW = cssW;
    this._cssH = cssH;
    this._pixelRatio = pixelRatio;
    if (cssW === 0 || cssH === 0) return;

    // Fit the whole frame, then let the world run on along whichever axis has room.
    const fit = Math.min(cssW / FRAME_W, cssH / FRAME_H);
    this.width = cssW / fit;
    this.height = cssH / fit;
    this._scale = fit * pixelRatio;
    this._canvas.width = Math.round(cssW * pixelRatio);
    this._canvas.height = Math.round(cssH * pixelRatio);
  }

  private _advanceShake(elapsedMs: number): void {
    if (this._shakeLeftMs <= 0) {
      this._shakeX = 0;
      this._shakeY = 0;
      return;
    }
    this._shakeLeftMs -= elapsedMs;
    this._shakeX = Math.round((Math.random() - 0.5) * this._shakeMagnitude);
    this._shakeY = Math.round((Math.random() - 0.5) * this._shakeMagnitude);
  }
}
