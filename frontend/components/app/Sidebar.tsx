"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  FileText,
  FolderClosed,
  ScanLine,
  User,
} from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LangSwitcher } from "@/components/ui/LangSwitcher";
import { useAppStore } from "@/lib/store";
import { getDictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Desktop-only left navigation rail. Mobile uses BottomNav instead. */
export function Sidebar() {
  const pathname = usePathname();
  const lang = useAppStore((s) => s.lang);
  const d = getDictionary(lang);

  const items = [
    { href: "/letters", label: d.nav.letters, Icon: FileText },
    { href: "/deadlines", label: d.nav.deadlines, Icon: CalendarClock },
    { href: "/documents", label: d.nav.documents, Icon: FolderClosed },
    { href: "/me", label: d.nav.me, Icon: User },
  ];
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[228px] shrink-0 flex-col border-e border-line bg-surface/60 px-3.5 py-6 md:flex lg:w-[252px] lg:px-4">
      <Link href="/letters" className="px-2">
        <Wordmark size="md" />
      </Link>

      <Link
        href="/scan"
        className="mt-7 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-black/10 bg-brand py-3 font-semibold text-brand-ink shadow-[0_1px_0_rgba(0,0,0,0.05)] transition-transform active:scale-[0.98]"
      >
        <ScanLine size={20} strokeWidth={2} aria-hidden />
        {d.nav.scanCta}
      </Link>

      <nav className="mt-6 flex flex-col gap-1">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[0.95rem] font-medium transition-colors",
                active
                  ? "bg-ink/[0.06] text-ink"
                  : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink",
              )}
            >
              <Icon size={20} strokeWidth={1.75} aria-hidden />
              {label}
              {active && (
                <span className="ms-auto size-1.5 rounded-full bg-brand" aria-hidden />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2 px-1 pt-6">
        <LangSwitcher className="flex-1" />
        <ThemeToggle />
      </div>
    </aside>
  );
}
