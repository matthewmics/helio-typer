import { Button } from "@/components/ui/button";
import { setViewer } from "@/lib/viewer-actions";

/**
 * There is no auth yet, so signing in only flips the preview to the signed-in
 * view. When real sign-in lands, this is the one place to point at it.
 */
export function SignInButton({ size }: { size?: "sm" | "md" }) {
  return (
    <form action={setViewer}>
      <input type="hidden" name="viewer" value="user" />
      <Button type="submit" size={size}>
        Sign in
      </Button>
    </form>
  );
}
