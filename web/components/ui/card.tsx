import Link from "next/link";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-panel p-5", className)}
      {...props}
    />
  );
}

/** The small all-caps heading that labels a card's contents. */
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "mb-4 font-display text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim",
        className,
      )}
      {...props}
    />
  );
}

/** The "see more" link at the foot of a card. */
export function CardLink({
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "focus-ring mt-4 inline-block font-display text-xs font-semibold uppercase tracking-widest text-accent hover:underline",
        className,
      )}
      {...props}
    />
  );
}

/** Vertical rhythm for a column of cards. */
export function CardStack({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-5", className)} {...props} />;
}
