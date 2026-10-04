import { cn } from "@/lib/cn";

export type MeterProps = React.ComponentProps<"div"> & {
  /** How full, 0 to 1. */
  value: number;
  /** Utility classes for the fill. */
  fill?: string;
};

/** A thin progress bar. Give it an `aria-label`, and `aria-valuetext` for real units. */
export function Meter({ value, fill = "bg-accent", className, ...props }: MeterProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 overflow-hidden rounded-full bg-well", className)}
      {...props}
    >
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
