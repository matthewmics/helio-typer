"use client";

import { useState } from "react";
import { ShipCard } from "@/components/hangar/ship-card";
import { ShipDetail } from "@/components/hangar/ship-detail";
import { DEFAULT_SHIP_ID, getShip, SHIPS } from "@/lib/data/ships";

/**
 * Owns the browse-and-equip state for the hangar. Equipping is local only until
 * there is a loadout endpoint to persist it to.
 */
export function HangarBrowser() {
  const [selectedId, setSelectedId] = useState(DEFAULT_SHIP_ID);
  const [equippedId, setEquippedId] = useState(DEFAULT_SHIP_ID);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_330px]">
      <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
        {SHIPS.map((ship) => (
          <ShipCard
            key={ship.id}
            ship={ship}
            selected={ship.id === selectedId}
            equipped={ship.id === equippedId}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      <ShipDetail
        ship={getShip(selectedId)}
        equipped={selectedId === equippedId}
        onEquip={setEquippedId}
      />
    </div>
  );
}
