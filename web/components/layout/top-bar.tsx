import Link from "next/link";
import { GuestCallsign } from "@/components/auth/guest-callsign";
import { SignInButton } from "@/components/auth/sign-in-button";
import { MainNav } from "@/components/layout/main-nav";
import { RocketMark } from "@/components/rocket-mark";
import { Avatar } from "@/components/ui/avatar";
import { Meter } from "@/components/ui/meter";
import { cn } from "@/lib/cn";
import { PILOT } from "@/lib/data/profile";
import { levelProgress } from "@/lib/levels";
import type { Viewer } from "@/lib/viewer";

/**
 * One row from `lg` up, lined up with the page content below it. Narrower than
 * that, the nav takes a second row of its own instead of scrolling sideways and
 * clipping its last links off the edge.
 */
export function TopBar({ viewer }: { viewer: Viewer }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-void/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-295 flex-wrap items-center gap-x-4 gap-y-2 px-6 pb-2 pt-3 sm:gap-x-6 lg:h-15 lg:flex-nowrap lg:py-0">
        <Link href="/" className="focus-ring flex shrink-0 items-center gap-2.5">
          <RocketMark className="size-5.5" />
          <b className="font-display text-lg font-bold tracking-[0.16em]">
            HELIOTYPER
          </b>
        </Link>

        <MainNav className="order-last w-full lg:order-0 lg:w-auto" />

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {viewer === "user" ? (
            <>
              <PilotReadout />

              {/* Hidden on a phone, where Profile in the nav already covers it. */}
              <Link
                href="/profile"
                className="focus-ring hidden items-center gap-2.5 sm:flex"
              >
                <Avatar name={PILOT.handle} />
                <span className="sr-only font-display text-sm font-semibold lg:not-sr-only">
                  {PILOT.handle}
                </span>
              </Link>
            </>
          ) : (
            <>
              {/* Hidden on a phone, where there is only room for the button. */}
              <span className="hidden items-baseline gap-2 rounded-full border border-line bg-panel px-3.5 py-1.5 font-display sm:flex">
                <span className={UNIT}>Guest</span>
                <b className="text-sm">
                  <GuestCallsign />
                </b>
              </span>
              <SignInButton size="sm" />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const READING = "flex items-baseline gap-1.5 px-2.5 py-1.5 sm:px-3.5";
const UNIT = "text-xs font-semibold uppercase tracking-widest text-ink-dim";

/**
 * Level and WPM at full body size. They used to be a 10px caption under the
 * handle, too small to read at a glance, and vanished entirely below `lg`.
 *
 * The level carries its XP bar, so the next level is always in sight. On a
 * phone there is no room beside it; the profile has the full bar.
 */
function PilotReadout() {
  const xp = levelProgress(PILOT.xp);
  const toNext = `${xp.into.toLocaleString()} / ${xp.span.toLocaleString()} XP to level ${xp.level + 1}`;

  return (
    <div className="flex items-center rounded-full border border-line bg-panel font-display text-base font-bold">
      <span className={READING} title={toNext}>
        <span className={UNIT}>
          <span aria-hidden>Lv</span>
          <span className="sr-only">Level</span>
        </span>
        {PILOT.level}
        <Meter
          value={xp.fraction}
          aria-label="Experience"
          aria-valuetext={toNext}
          className="ml-1 hidden w-12 self-center sm:block"
        />
      </span>

      <span className={cn(READING, "border-l border-line")}>
        {PILOT.wpm}
        <span className={UNIT}>WPM</span>
      </span>
    </div>
  );
}
