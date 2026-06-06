"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { DIR } from "@/lib/i18n";

const IS_MOCK = process.env.NEXT_PUBLIC_API_MODE === "mock";

/**
 * Boots the app on the client:
 *  - keeps <html> data-theme / lang / dir in sync with the store
 *  - in mock mode, starts the MSW worker before any request is made
 *  - in live mode (production build), registers the Serwist service worker
 *  - ensures an anonymous device session token exists
 *
 * Children render only once this bootstrap completes so no request races MSW.
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
      if (IS_MOCK) {
        const { worker } = await import("@/lib/api/mocks/browser");
        await worker.start({
          onUnhandledRequest: "bypass",
          serviceWorker: { url: "/mockServiceWorker.js" },
        });
      } else if (
        process.env.NODE_ENV === "production" &&
        "serviceWorker" in navigator
      ) {
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
        <span className="font-mono text-sm tracking-widest uppercase">
          Klar
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
