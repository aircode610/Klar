"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

/**
 * Gates a subtree behind a session. If signed out (after the persisted store has
 * hydrated on the client), it redirects to /login. Renders nothing until the
 * session is confirmed, so protected screens never flash for signed-out users.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAppStore((s) => s.auth?.user);
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (useAppStore.getState().auth?.user) setOk(true);
    else router.replace("/login");
  }, [router, user]);

  if (!ok) return null;
  return <>{children}</>;
}
