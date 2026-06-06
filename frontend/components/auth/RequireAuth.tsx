"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";

/**
 * Gates a subtree behind a session.
 *
 * Two-step verification:
 *   1. Synchronous: if the persisted store has no `auth.user`, redirect to
 *      /login immediately — no flash, no network call.
 *   2. Asynchronous: if there *is* a persisted user, verify it against the
 *      backend via GET /auth/me. The persisted entry can be stale (server-
 *      side logout, cookie expiry, backend DB nuke), so trusting localStorage
 *      alone lets the user through to screens that immediately 401.
 *
 * On verification failure we clear the store and redirect to /login with
 * `?next=` so the user lands back on the page they were trying to reach
 * after they sign in again.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAppStore((s) => s.auth?.user);
  const setAuth = useAppStore((s) => s.setAuth);
  const signOut = useAppStore((s) => s.signOut);
  const router = useRouter();
  const pathname = usePathname();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const goLogin = () => {
      const next = pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    };

    // Fast path: nothing persisted → bounce immediately, skip the round trip.
    if (!useAppStore.getState().auth?.user) {
      goLogin();
      return;
    }

    // Slow path: verify the cookie is still valid server-side.
    (async () => {
      try {
        const res = await api.me();
        if (cancelled) return;
        // Refresh the persisted user with whatever the backend says is current
        // (language preference, email, etc. may have changed on another device).
        setAuth({ user: { id: res.user.id, email: res.user.email } });
        setVerified(true);
      } catch (err) {
        if (cancelled) return;
        // `request()` already calls signOut() on 401; call it explicitly here
        // too so any other error (network, 5xx) is treated the same — better
        // to send the user to /login than to leave them staring at a stuck
        // skeleton screen.
        if (!(err instanceof ApiError) || err.status === 401) {
          signOut();
        }
        goLogin();
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-run when the path changes (user navigated to a new protected page)
    // or when the persisted user actually changed (login/logout in another tab).
  }, [pathname, user?.id, router, setAuth, signOut]);

  if (!verified) return null;
  return <>{children}</>;
}
