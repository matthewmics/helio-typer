import { RocketMark } from "@/components/rocket-mark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { RARITY_TEXT } from "@/lib/rarity";
import type { Ship } from "@/lib/types";

export type ShipDetailProps = {
  ship: Ship;
  equipped: boolean;
  onEquip: (id: string) => void;
};

/**
 * The detail panel for the selected ship.
 *
 * This used to be three stat meters and a perk box. Both are gone: ships are
 * cosmetic only, so there is no number to plot and no bonus to describe. The art
 * gets the space the meters were taking instead, which is the honest layout for
 * a screen whose whole subject is how something looks.
 */
export function ShipDetail({ ship, equipped, onEquip }: ShipDetailProps) {
  return (
    <Card>
      <div className="mb-4 grid h-60 place-items-center rounded-xl border border-line bg-[radial-gradient(ellipse_at_50%_78%,rgba(79,216,255,0.15),transparent_68%),var(--color-well)]">
        <RocketMark
          detail="full"
          hull={ship.hull}
          fin={ship.fin}
          finShadow={ship.finShadow}
          className="w-24 animate-float"
        />
      </div>

      <b className="block font-display text-lg">{ship.name}</b>
      <span
        className={cn(
          "mb-4 block font-display text-2xs font-bold uppercase tracking-[0.13em]",
          RARITY_TEXT[ship.rarity],
        )}
      >
        {ship.rarity}
      </span>

      <p className="text-xs leading-relaxed text-ink-dim">{ship.flavor}</p>

      <p className="mt-4 rounded-lg border border-line bg-panel-hi px-3 py-2.5 text-2xs leading-relaxed text-ink-dim">
        <b className="text-ink">Paint only.</b> Every ship flies identical
        physics, so what you fly never changes a race result.
      </p>

      <div className="mt-4">
        {!ship.owned ? (
          <Button variant="ghost" block>
            Unlock · {ship.cost?.toLocaleString()} ◈
          </Button>
        ) : equipped ? (
          <Button variant="ghost" block disabled>
            Equipped
          </Button>
        ) : (
          <Button block onClick={() => onEquip(ship.id)}>
            Equip
          </Button>
        )}
      </div>
    </Card>
  );
}
