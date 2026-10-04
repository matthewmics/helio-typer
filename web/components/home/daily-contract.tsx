import { Card, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";

export function DailyContract() {
  return (
    <Card>
      <CardTitle>Daily contract</CardTitle>
      <div className="flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold bg-gold/[0.13] text-lg">
          ◎
        </span>
        <div className="min-w-0 flex-1">
          <b className="font-display text-base">
            Finish 3 races without losing a hull segment
          </b>
          <Meter
            value={66}
            fill="bg-linear-90 from-gold to-[#ffd88a]"
            className="mt-2.5"
          />
          <span className="mt-1.5 block text-2xs text-ink-dim">
            2 of 3 complete
          </span>
        </div>
      </div>
    </Card>
  );
}
