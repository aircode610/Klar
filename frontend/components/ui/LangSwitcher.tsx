"use client";

import { Globe } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { LANGS, LANG_LABEL, DIR } from "@/lib/i18n";
import type { Lang } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Language picker. Updates the store (which drives <html> lang/dir) and tells the
 * backend. Persian and Arabic flip the whole layout to RTL.
 */
export function LangSwitcher({ className }: { className?: string }) {
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);

  const onChange = (next: Lang) => {
    setLang(next);
    // Language is local; the backend receives it per-request as ?lang=.
  };

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-line bg-surface px-3 text-ink-2",
        className,
      )}
    >
      <Globe size={17} strokeWidth={1.75} aria-hidden />
      <span className="sr-only">Language</span>
      <select
        value={lang}
        onChange={(e) => onChange(e.target.value as Lang)}
        dir="ltr"
        className="h-9 cursor-pointer appearance-none bg-transparent pe-1 text-[0.875rem] font-medium text-ink outline-none"
      >
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {LANG_LABEL[l]} {DIR[l] === "rtl" ? "‫(RTL)‬" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
