import { ShipPreview } from "@/components/hangar/ship-preview";
import { ExhaustTag } from "@/components/hangar/ship-sprite";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Ship } from "@/lib/types";

export type ShipDetailProps = {
  ship: Ship;
  equipped: boolean;
  onEquip: (id: string) => void;
};

/** The selected ship: a live preview you can throttle and breach, then equip. */
export function ShipDetail({ ship, equipped, onEquip }: ShipDetailProps) {
  return (
    <Card>
      <ShipPreview ship={ship} />

      <b className="block font-display text-lg">{ship.name}</b>
      <ExhaustTag exhaust={ship.exhaust} className="mb-4" />

      <p className="text-xs leading-relaxed text-ink-dim">{ship.flavor}</p>

      <div className="mt-4">
        {equipped ? (
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
