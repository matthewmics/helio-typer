"use client";

import { useMatchmaking } from "@/components/matchmaking/matchmaking-provider";

/** The callsign matchmaking handed this guest, until the socket has said one. */
export function GuestCallsign() {
  const { guest } = useMatchmaking();
  return <>{guest?.name ?? "Guest pilot"}</>;
}
