import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "@/types";

export type Theme = "light" | "dark";

const DEFAULT_LANG = (process.env.NEXT_PUBLIC_DEFAULT_LANG as Lang) || "en";

interface AppState {
  lang: Lang;
  theme: Theme;
  /** anonymous device session token from POST /v1/session */
  sessionToken: string | null;
  /** true once onboarding language has been chosen */
  onboarded: boolean;

  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSessionToken: (token: string | null) => void;
  setOnboarded: (value: boolean) => void;
}

/**
 * The small slice of global state Klar needs: chosen language, theme, and the
 * device session token. Persisted to localStorage so the PWA remembers across
 * launches. Everything else (letters, deadlines) is fetched and cached at the
 * data layer.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      lang: DEFAULT_LANG,
      theme: "light",
      sessionToken: null,
      onboarded: false,

      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setSessionToken: (sessionToken) => set({ sessionToken }),
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    {
      name: "klar-app",
      partialize: (s) => ({
        lang: s.lang,
        theme: s.theme,
        sessionToken: s.sessionToken,
        onboarded: s.onboarded,
      }),
    },
  ),
);
