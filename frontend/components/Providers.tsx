"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { DIR } from "@/lib/i18n";

/**
 * Boots the app on the client:
 *  - keeps <html> data-theme / lang / dir in sync with the store
 *  - registers the Serwist service worker in production
 *
 * Talks to the live backend at NEXT_PUBLIC_API_URL (see lib/api/client.ts).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);

  // Reflect theme + language onto <html> whenever they change.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.lang = lang;
    root.dir = DIR[lang];
  }, [theme, lang]);

  // One-time bootstrap.
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        } catch {
          /* SW registration is best-effort */
        }
      }
      if (!cancelled) setReady(true);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-ink-2">
        <span className="font-mono text-sm tracking-widest uppercase">Klar</span>
      </div>
    );
  }

  return <>{children}</>;
}
