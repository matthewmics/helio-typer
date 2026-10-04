"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/hangar", label: "Hangar" },
  { href: "/rankings", label: "Rankings" },
  { href: "/profile", label: "Profile" },
];

/**
 * Four equal columns on a phone, so every link fits without scrolling sideways.
 * A plain row from `sm` up.
 */
export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("grid grid-cols-4 gap-1 sm:flex", className)}>
      {LINKS.map(({ href, label }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring whitespace-nowrap rounded-md px-1 py-2 text-center font-display text-sm font-semibold uppercase tracking-widest transition-colors duration-150 sm:px-3.5",
              active
                ? "bg-accent/10 text-accent"
                : "text-ink-dim hover:bg-panel hover:text-ink",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
