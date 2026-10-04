import { ViewerToggle } from "@/components/auth/viewer-toggle";
import { TopBar } from "@/components/layout/top-bar";
import { ViewFade } from "@/components/layout/view-fade";
import { getViewer } from "@/lib/viewer";

/**
 * The chrome every hub page shares. The race screen will live outside this
 * group so it can go full bleed without the top bar.
 */
export default async function ShellLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar viewer={viewer} />
      {/* Bottom padding clears the floating preview toggle at the end of a page. */}
      <main className="mx-auto w-full max-w-295 flex-1 px-6 pb-24 pt-7">
        <ViewFade>{children}</ViewFade>
      </main>
      <ViewerToggle viewer={viewer} />
    </div>
  );
}
