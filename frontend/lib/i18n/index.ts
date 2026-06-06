import type { Lang } from "@/types";
import { en, type Dictionary } from "./dictionaries/en";
import { de } from "./dictionaries/de";
import { fa } from "./dictionaries/fa";

/** All languages Klar supports. Mirrors AppConfig.supportedLanguages. */
export const LANGS: Lang[] = ["en", "de", "fa", "tr", "ar", "uk"];

/** Text direction per language. Persian and Arabic are right-to-left. */
export const DIR: Record<Lang, "ltr" | "rtl"> = {
  en: "ltr",
  de: "ltr",
  fa: "rtl",
  tr: "ltr",
  ar: "rtl",
  uk: "ltr",
};

/** Human label for each language, in its own script. */
export const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  de: "Deutsch",
  fa: "فارسی",
  tr: "Türkçe",
  ar: "العربية",
  uk: "Українська",
};

/** Partial overrides per language. Missing entries deep-fall-back to English. */
const PARTIALS: Partial<Record<Lang, Partial<Dictionary>>> = {
  de,
  fa,
  // tr, ar, uk to be populated in Phase 4/5; they fall back to en until then.
};

/** Recursively merge a partial dictionary over the English base. */
function deepMerge<T>(base: T, override: Partial<T> | undefined): T {
  if (!override) return base;
  const out = { ...base } as T;
  for (const key in override) {
    const o = override[key];
    const b = (base as Record<string, unknown>)[key];
    if (o && typeof o === "object" && !Array.isArray(o) && typeof b === "object") {
      (out as Record<string, unknown>)[key] = deepMerge(
        b as object,
        o as object,
      );
    } else if (o !== undefined) {
      (out as Record<string, unknown>)[key] = o;
    }
  }
  return out;
}

const cache = new Map<Lang, Dictionary>();

/** Returns a fully-populated dictionary for the language (en-backed). */
export function getDictionary(lang: Lang): Dictionary {
  const cached = cache.get(lang);
  if (cached) return cached;
  const merged = deepMerge(en, PARTIALS[lang]);
  cache.set(lang, merged);
  return merged;
}

export type { Dictionary };
export { en };
