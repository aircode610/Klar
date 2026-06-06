import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, Lang, Letter } from "@/types";

export type Theme = "light" | "dark";

const DEFAULT_LANG = (process.env.NEXT_PUBLIC_DEFAULT_LANG as Lang) || "en";

interface AppState {
  lang: Lang;
  theme: Theme;
  onboarded: boolean;

  /** Auth session. null = signed out. */
  auth: { token: string; user: AuthUser } | null;

  /**
   * Client-side cache of letters by id. The backend has no "list letters"
   * endpoint (it is obligation-centric), so the app remembers the letters it has
   * uploaded/opened — this also powers offline viewing.
   */
  letters: Record<string, Letter>;
  letterIds: string[]; // most-recent first

  /** A File staged by the capture screen, uploaded by the processing screen. */
  pendingUpload: File | null;

  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setOnboarded: (value: boolean) => void;
  cacheLetter: (letter: Letter) => void;
  setPendingUpload: (file: File | null) => void;
  setAuth: (auth: { token: string; user: AuthUser } | null) => void;
  signOut: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      lang: DEFAULT_LANG,
      theme: "light",
      onboarded: false,
      auth: null,
      letters: {},
      letterIds: [],
      pendingUpload: null,

      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setOnboarded: (onboarded) => set({ onboarded }),
      cacheLetter: (letter) =>
        set((s) => ({
          letters: { ...s.letters, [letter.id]: letter },
          letterIds: [letter.id, ...s.letterIds.filter((id) => id !== letter.id)],
        })),
      setPendingUpload: (pendingUpload) => set({ pendingUpload }),
      setAuth: (auth) => set({ auth }),
      signOut: () => set({ auth: null, letters: {}, letterIds: [] }),
    }),
    {
      name: "klar-app",
      // pendingUpload (a File) is intentionally not persisted.
      partialize: (s) => ({
        lang: s.lang,
        theme: s.theme,
        onboarded: s.onboarded,
        auth: s.auth,
        letters: s.letters,
        letterIds: s.letterIds,
      }),
    },
  ),
);
