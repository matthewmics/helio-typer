import { cn } from "@/lib/cn";
import type { Viewer } from "@/lib/viewer";
import { setViewer } from "@/lib/viewer-actions";

const OPTIONS: { value: Viewer; label: string }[] = [
  { value: "guest", label: "Guest" },
  { value: "user", label: "Signed in" },
];

/**
 * Temporary, until there is auth: switches the whole site between the guest
 * and signed-in views. Delete it, along with lib/viewer-actions.ts, once real
 * sign-in exists.
 */
export function ViewerToggle({ viewer }: { viewer: Viewer }) {
  return (
    <form
      action={setViewer}
      aria-label="Preview the site as"
      className="fixed bottom-4 right-4 z-30 flex items-center gap-1 rounded-full border border-line-hi bg-panel/95 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md"
    >
      <span className="hidden pl-2.5 pr-1 font-display text-xs font-semibold uppercase tracking-widest text-ink-dim sm:inline">
        Preview
      </span>
      {OPTIONS.map((option) => {
        const active = option.value === viewer;
        return (
          <button
            key={option.value}
            type="submit"
            name="viewer"
            value={option.value}
            aria-pressed={active}
            className={cn(
              "focus-ring rounded-full px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-colors duration-150",
              active
                ? "bg-accent text-[#04202a]"
                : "text-ink-dim hover:bg-panel-hi hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </form>
  );
}
