import type { Rgb } from './util';

/**
 * Every generator in assets/ writes the same atlas shape, so one loader covers all
 * five groups.
 *
 * The convention that matters is the per-frame anchor: `ax`/`ay` is the point that
 * should land on the position you draw at. Every draw in the game therefore comes
 * down to `drawImage(sheet, ..., x - ax, y - ay, ...)`, and no caller ever does
 * per-frame offset maths. See {@link drawSprite}.
 */
export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

export interface AtlasAnimation {
  frames: string[];
  fps?: number;
  loop?: boolean;
}

export interface AtlasJson {
  id: string;
  image: string;
  size: { w: number; h: number };
  frames: Record<string, AtlasFrame>;
  animations?: Record<string, AtlasAnimation>;
  /** Frames authored white, meant to be multiplied by a runtime tint. */
  tintable?: string[];
  /** Disc radius per frame, where the cell is bigger than the body (rings). Planets only. */
  radii?: Record<string, number>;
  /** Frames whose pattern repeats seamlessly along x. */
  tileableX?: string[];
}

/**
 * One drawable frame: a rect on some image, plus the anchor that lands on the
 * draw position.
 *
 * A frame straight off a sheet and a tinted copy on its own small canvas are both
 * just this, so nothing that draws has to know which one it was handed.
 */
export interface Sprite {
  readonly image: CanvasImageSource;
  readonly sx: number;
  readonly sy: number;
  readonly w: number;
  readonly h: number;
  readonly ax: number;
  readonly ay: number;
}

/**
 * An atlas animation, resolved to sprites.
 *
 * Clips hold no playback state. Whoever draws one picks the frame off a clock
 * with {@link frameAt}, which is what keeps every tile of the heliopause on the
 * same frame and lets a plume change tier without restarting anything.
 */
export interface Clip {
  readonly frames: readonly Sprite[];
  readonly fps: number;
  readonly loop: boolean;
  /** Seconds for one pass through every frame. */
  readonly duration: number;
}

/** A loaded atlas: the decoded sheet plus name-keyed lookups for sprites and clips. */
export class Atlas {
  readonly json: AtlasJson;

  private readonly _sprites = new Map<string, Sprite>();
  private readonly _tinted = new Map<string, Sprite>();
  private readonly _isolated = new Map<string, Sprite>();

  constructor(json: AtlasJson, image: CanvasImageSource) {
    this.json = json;
    for (const [name, f] of Object.entries(json.frames)) {
      this._sprites.set(name, { image, sx: f.x, sy: f.y, w: f.w, h: f.h, ax: f.ax, ay: f.ay });
    }
  }

  frame(name: string): AtlasFrame {
    const f = this.json.frames[name];
    if (!f) throw new Error(`atlas "${this.json.id}" has no frame "${name}"`);
    return f;
  }

  sprite(name: string): Sprite {
    const s = this._sprites.get(name);
    if (!s) throw new Error(`atlas "${this.json.id}" has no frame "${name}"`);
    return s;
  }

  /**
   * A frame with its colour multiplied by `rgb`, for the white textures the atlas
   * lists under `tintable`.
   *
   * Built on first use and cached per frame and colour. It is a pixel pass over
   * the frame, so ask for tints up front rather than once per draw.
   */
  tinted(name: string, rgb: Rgb): Sprite {
    const key = `${name}|${rgb[0]},${rgb[1]},${rgb[2]}`;
    let s = this._tinted.get(key);
    if (!s) {
      s = tint(this.sprite(name), rgb);
      this._tinted.set(key, s);
    }
    return s;
  }

  /**
   * A frame copied onto a canvas of its own, cached.
   *
   * Smoothing samples a little way past a frame's edge, so a frame drawn at a
   * fractional position picks up a hairline of whatever the sheet packs next to
   * it. That is invisible against the transparent margins most frames have, but
   * not for frames packed edge to edge with solid rows between them.
   */
  isolated(name: string): Sprite {
    let s = this._isolated.get(name);
    if (!s) {
      const src = this.sprite(name);
      const ctx = blankCanvas(src.w, src.h);
      ctx.drawImage(src.image, src.sx, src.sy, src.w, src.h, 0, 0, src.w, src.h);
      s = { image: ctx.canvas, sx: 0, sy: 0, w: src.w, h: src.h, ax: src.ax, ay: src.ay };
      this._isolated.set(name, s);
    }
    return s;
  }

  /**
   * One pixel of a frame as a CSS colour, for code-drawn fills that have to
   * match the art exactly without copying a colour out of the generator.
   */
  colorAt(name: string, x: number, y: number): string {
    const s = this.sprite(name);
    const ctx = scratchContext(1, 1);
    ctx.drawImage(s.image, s.sx + x, s.sy + y, 1, 1, 0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  }

  /**
   * An animation as the atlas defines it. fps and looping both come from the
   * atlas, so the generator stays the source of truth for timing as well as art.
   */
  clip(name: string): Clip {
    const def = this.json.animations?.[name];
    if (!def) throw new Error(`atlas "${this.json.id}" has no animation "${name}"`);
    const fps = def.fps ?? 12;
    return {
      frames: def.frames.map((f) => this.sprite(f)),
      fps,
      loop: def.loop !== false,
      duration: def.frames.length / fps,
    };
  }
}

/** The frame `t` seconds into a clip. A loop wraps; a one-shot holds its last frame. */
export function frameAt(clip: Clip, t: number): Sprite {
  const n = clip.frames.length;
  const i = Math.floor(Math.max(0, t) * clip.fps);
  return clip.frames[clip.loop ? i % n : Math.min(i, n - 1)];
}

/** Draw a sprite with its anchor on (x, y), optionally scaled about that anchor. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
  scale = 1,
): void {
  ctx.drawImage(s.image, s.sx, s.sy, s.w, s.h, x - s.ax * scale, y - s.ay * scale, s.w * scale, s.h * scale);
}

/**
 * Draw a sprite with its anchor on (x, y), scaled and rotated about that anchor.
 *
 * Only for the things that turn or stretch unevenly (planets, clouds, sparks);
 * everything else goes through the cheaper {@link drawSprite}.
 */
export function drawSpriteTransformed(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  rotation: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(s.image, s.sx, s.sy, s.w, s.h, -s.ax, -s.ay, s.w, s.h);
  ctx.restore();
}

let scratch: CanvasRenderingContext2D | null = null;

/**
 * The one canvas every pixel readback goes through, resized (and so cleared) to
 * `w` x `h`. It is flagged for readback, so the browser keeps it in memory
 * instead of reading each one back off the GPU.
 */
function scratchContext(w: number, h: number): CanvasRenderingContext2D {
  scratch ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!scratch) throw new Error('this browser cannot draw a 2D canvas');
  scratch.canvas.width = w;
  scratch.canvas.height = h;
  return scratch;
}

/**
 * Multiply a frame's colour by `rgb` and keep its alpha, which is exactly what a
 * tinted sprite does in a shader.
 *
 * Done per pixel, once, rather than with the `multiply` then `destination-in`
 * composite trick in the assets' preview pages. That trick is close, but it
 * lightens every partly transparent pixel toward the flat tint, and partly
 * transparent is precisely what the soft edge of every smoke puff and star is.
 */
function tint(src: Sprite, rgb: Rgb): Sprite {
  const ctx = scratchContext(src.w, src.h);
  ctx.drawImage(src.image, src.sx, src.sy, src.w, src.h, 0, 0, src.w, src.h);

  const pixels = ctx.getImageData(0, 0, src.w, src.h);
  const d = pixels.data;
  const [r, g, b] = rgb;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = (d[i] * r) / 255;
    d[i + 1] = (d[i + 1] * g) / 255;
    d[i + 2] = (d[i + 2] * b) / 255;
  }

  // The result gets a canvas of its own without the readback flag, so it stays
  // an ordinary, fast thing to draw from.
  const out = blankCanvas(src.w, src.h);
  out.putImageData(pixels, 0, 0);
  return { image: out.canvas, sx: 0, sy: 0, w: src.w, h: src.h, ax: src.ax, ay: src.ay };
}

function blankCanvas(w: number, h: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('this browser cannot draw a 2D canvas');
  return ctx;
}
