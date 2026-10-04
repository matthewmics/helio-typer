import { cookies } from "next/headers";

/**
 * Who is looking: a guest, or a signed-in pilot.
 *
 * Temporary. There is no auth or user schema yet, so a preview toggle keeps
 * this in a cookie, purely to see how each version of the site looks. Real
 * sign-in replaces the cookie with a session, and the toggle goes away.
 */
export type Viewer = "guest" | "user";

export const VIEWER_COOKIE = "heliotyper.viewer";

/** Signed in unless the preview says guest. */
export async function getViewer(): Promise<Viewer> {
  const value = (await cookies()).get(VIEWER_COOKIE)?.value;
  return value === "guest" ? "guest" : "user";
}
