"use server";

import { cookies } from "next/headers";
import { VIEWER_COOKIE } from "@/lib/viewer";

/**
 * Switch the preview between the guest and signed-in views.
 *
 * Not auth, and not a security boundary: nothing is protected by it, it only
 * picks which version of the UI renders. Setting a cookie in a Server Action
 * re-renders the current page, so the switch lands in the same round trip.
 */
export async function setViewer(formData: FormData): Promise<void> {
  const viewer = formData.get("viewer") === "guest" ? "guest" : "user";
  (await cookies()).set(VIEWER_COOKIE, viewer, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
