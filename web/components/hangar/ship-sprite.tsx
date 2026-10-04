import { cn } from "@/lib/cn";
import type { Ship } from "@/lib/types";

// Every rocket sheet shares one layout (assets/rockets/README.md), so these
// rects hold for all of them. Frames also share the ship-centre anchor, which
// is why the plume can sit in the same box as the hull with no offset.
const SHEET = { w: 768, h: 1152 };
const FRAME = { w: 96, h: 176 };
const HULL = { x: 0, y: 0 };
/** `thrust_t2_0`: cruising. */
const PLUME = { x: 96, y: 176 };

export type ShipSpriteProps = {
  id: Ship["id"];
  /** CSS px per sprite px. The art is drawn 1:1, so 1 is its native size. */
  scale?: number;
  className?: string;
};

/**
 * One rocket at cruise, cut straight out of its sprite sheet with plain CSS,
 * so a grid of them costs no canvases. The selected ship gets the animated
 * {@link ShipPreview} instead.
 */
export function ShipSprite({ id, scale = 1, className }: ShipSpriteProps) {
  const px = (n: number) => `${n * scale}px`;
  // The first layer paints on top: hull over plume, the game's draw order.
  const layers = [HULL, PLUME];
  const sheet = `url(/game/rockets/${id}.png)`;

  return (
    <div
      aria-hidden
      className={cn("shrink-0 bg-no-repeat", className)}
      style={{
        width: px(FRAME.w),
        height: px(FRAME.h),
        backgroundImage: layers.map(() => sheet).join(", "),
        backgroundSize: `${px(SHEET.w)} ${px(SHEET.h)}`,
        backgroundPosition: layers
          .map((frame) => `${px(-frame.x)} ${px(-frame.y)}`)
          .join(", "),
      }}
    />
  );
}

/**
 * The exhaust color as a labelled swatch. `short` leaves the word "exhaust" to
 * screen readers, for the grid, where four cards a row cannot fit it on one line.
 */
export function ExhaustTag({
  exhaust,
  short = false,
  className,
}: {
  exhaust: Ship["exhaust"];
  short?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-widest text-ink-dim",
        className,
      )}
    >
      <i
        className="size-2 shrink-0 rounded-full"
        style={{
          background: exhaust.swatch ?? exhaust.color,
          boxShadow: `0 0 8px ${exhaust.color}`,
        }}
      />
      <span>
        {exhaust.label}
        <span className={cn(short && "sr-only")}> exhaust</span>
      </span>
    </span>
  );
}
