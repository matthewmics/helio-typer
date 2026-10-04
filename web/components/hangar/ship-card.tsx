import { ExhaustTag, ShipSprite } from "@/components/hangar/ship-sprite";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Ship } from "@/lib/types";

export type ShipCardProps = {
  ship: Ship;
  selected: boolean;
  equipped: boolean;
  onSelect: (id: string) => void;
};

export function ShipCard({
  ship,
  selected,
  equipped,
  onSelect,
}: ShipCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(ship.id)}
      className={cn(
        // Extra top room on a phone, where the badge would otherwise sit on the nose.
        "focus-ring relative flex flex-col items-center rounded-2xl border bg-panel px-3 pb-4 pt-8 text-center transition duration-150 sm:pt-5",
        selected
          ? "border-accent bg-accent/6 shadow-[0_0_0_1px_var(--color-accent),0_8px_26px_rgba(79,216,255,0.16)]"
          : "border-line hover:-translate-y-0.75 hover:border-line-hi",
      )}
    >
      {equipped && (
        <Badge tone="accent" solid className="absolute right-2 top-2">
          Equipped
        </Badge>
      )}

      <ShipSprite id={ship.id} scale={0.8} className="mb-3" />

      <b className="mb-1 block font-display text-base">{ship.name}</b>
      <ExhaustTag exhaust={ship.exhaust} short />
    </button>
  );
}
