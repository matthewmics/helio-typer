import Link from "next/link";
import { RocketMark } from "@/components/rocket-mark";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { MeterRow } from "@/components/ui/meter";
import { ROOM_CODE, ROOM_SETTINGS } from "@/lib/data/lobby";
import { PILOT } from "@/lib/data/profile";
import { getShip } from "@/lib/data/ships";

export function RoomPanel() {
  return (
    <Card>
      <CardTitle>Room</CardTitle>

      <div className="mb-4 flex items-center gap-3 rounded-xl border border-dashed border-line-hi bg-well px-4 py-3">
        <div>
          <span className="block text-2xs uppercase tracking-[0.11em] text-ink-dim">
            Room code
          </span>
          <b className="font-display text-lg tracking-[0.22em] text-accent">
            {ROOM_CODE}
          </b>
        </div>
        <Button variant="ghost" size="sm" className="ml-auto">
          Copy
        </Button>
      </div>

      {ROOM_SETTINGS.map((setting) => (
        <MeterRow
          key={setting.label}
          label={setting.label}
          value={setting.value}
        />
      ))}
    </Card>
  );
}

export function LoadoutPanel() {
  const ship = getShip(PILOT.shipId);

  return (
    <Card>
      <CardTitle>Your loadout</CardTitle>
      <div className="flex items-center gap-3.5">
        <RocketMark
          hull={ship.hull}
          fin={ship.fin}
          finShadow={ship.finShadow}
          className="w-10 shrink-0"
        />
        <div className="min-w-0">
          <b className="block font-display text-base">{ship.name}</b>
          <span className="text-2xs text-ink-dim">
            {ship.rarity}
          </span>
        </div>
        <Link
          href="/hangar"
          className={buttonStyles({ variant: "ghost", size: "sm", className: "ml-auto" })}
        >
          Swap
        </Link>
      </div>
    </Card>
  );
}
