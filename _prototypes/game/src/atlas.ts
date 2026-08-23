import {
  Animation,
  AnimationStrategy,
  ImageSource,
  Sprite,
  SpriteSheet,
  Vector,
  vec,
} from 'excalibur';

/**
 * Every generator in assets/ writes the same atlas shape, so one loader covers all
 * five groups.
 *
 * The important convention is the per-frame anchor: `ax`/`ay` is the point that
 * should land on the position you draw at. The raw canvas call is
 * `drawImage(..., x - ax, y - ay, ...)`; in Excalibur the equivalent is a relative
 * graphics anchor of `(ax / w, ay / h)`, which is what `anchorOf()` returns.
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

export interface AnimationOverrides {
  /** Override the atlas fps. */
  fps?: number;
  strategy?: AnimationStrategy;
}

/**
 * A loaded atlas: the sheet plus name-keyed lookups for frames, sprites and
 * animations.
 *
 * Construct only after the underlying {@link ImageSource} has finished loading.
 */
export class Atlas {
  readonly json: AtlasJson;
  readonly image: ImageSource;

  private readonly _sheet: SpriteSheet;
  private readonly _indexOf = new Map<string, number>();

  constructor(json: AtlasJson, image: ImageSource) {
    this.json = json;
    this.image = image;

    // Object key order is the insertion order the generator wrote, and it is
    // stable, so a parallel array of source views lines up with a name -> index map.
    const names = Object.keys(json.frames);
    names.forEach((name, i) => this._indexOf.set(name, i));

    this._sheet = SpriteSheet.fromImageSourceWithSourceViews({
      image,
      sourceViews: names.map((name) => {
        const f = json.frames[name];
        return { x: f.x, y: f.y, width: f.w, height: f.h };
      }),
    });
  }

  has(name: string): boolean {
    return this._indexOf.has(name);
  }

  frame(name: string): AtlasFrame {
    const f = this.json.frames[name];
    if (!f) throw new Error(`atlas "${this.json.id}" has no frame "${name}"`);
    return f;
  }

  /**
   * The frame's anchor expressed the way {@link GraphicsComponent.anchor} wants it:
   * a 0..1 fraction of the frame size. Excalibur offsets a graphic by
   * `-width * anchor.x`, so this puts the atlas anchor point exactly on the actor.
   */
  anchorOf(name: string): Vector {
    const f = this.frame(name);
    return vec(f.ax / f.w, f.ay / f.h);
  }

  /** A fresh {@link Sprite} for a frame. Each call returns a new instance, so tint and opacity are per-caller. */
  sprite(name: string): Sprite {
    const i = this._indexOf.get(name);
    if (i === undefined) throw new Error(`atlas "${this.json.id}" has no frame "${name}"`);
    return this._sheet.sprites[i].clone();
  }

  /** Sprites for a whole animation, in play order. Useful when you want to drive frames yourself. */
  spritesOf(animationName: string): Sprite[] {
    return this._animationDef(animationName).frames.map((f) => this.sprite(f));
  }

  /**
   * Build an {@link Animation} from the atlas definition. fps and loop come from the
   * atlas unless overridden, so the generator stays the source of truth for timing
   * as well as art.
   */
  animation(name: string, overrides: AnimationOverrides = {}): Animation {
    const def = this._animationDef(name);
    const fps = overrides.fps ?? def.fps ?? 12;
    const strategy =
      overrides.strategy ?? (def.loop === false ? AnimationStrategy.Freeze : AnimationStrategy.Loop);

    return new Animation({
      strategy,
      frames: def.frames.map((frameName) => ({
        graphic: this.sprite(frameName),
        duration: 1000 / fps,
      })),
    });
  }

  private _animationDef(name: string): AtlasAnimation {
    const def = this.json.animations?.[name];
    if (!def) throw new Error(`atlas "${this.json.id}" has no animation "${name}"`);
    return def;
  }
}
