"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, FileText, FolderClosed, ScanLine, User } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { getDictionary } from "@/lib/i18n";

const STROKE = 1.75;

/**
 * Fixed bottom tab bar: four destinations plus a prominent central lime scan
 * FAB. Sits above the safe-area inset and is always thumb-reachable.
 */
export function BottomNav() {
  const pathname = usePathname();
  const lang = useAppStore((s) => s.lang);
  const d = getDictionary(lang);

  const tabs = [
    { href: "/letters", label: d.nav.letters, Icon: FileText },
    { href: "/deadlines", label: d.nav.deadlines, Icon: CalendarClock },
    { href: "/documents", label: d.nav.documents, Icon: FolderClosed },
    { href: "/me", label: d.nav.me, Icon: User },
  ] as const;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label={d.appName}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {tabs.slice(0, 2).map(({ href, label, Icon }) => (
          <NavTab key={href} {...{ href, label, Icon }} active={isActive(href)} />
        ))}

        {/* Center scan FAB */}
        <div className="flex items-center justify-center">
          <Link
            href="/scan"
            aria-label={d.nav.scan}
            className="-mt-8 flex size-16 items-center justify-center rounded-lg border border-ink/10 bg-brand text-brand-ink shadow-[var(--shadow-float)] transition-transform active:scale-95"
          >
            <ScanLine size={26} strokeWidth={2} aria-hidden />
          </Link>
        </div>

        {tabs.slice(2).map(({ href, label, Icon }) => (
          <NavTab key={href} {...{ href, label, Icon }} active={isActive(href)} />
        ))}
      </div>
    </nav>
  );
}

function NavTab({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof FileText;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-1 py-2 text-[0.65rem] transition-colors ${
        active ? "text-ink" : "text-ink-2"
      }`}
    >
      <Icon size={22} strokeWidth={STROKE} aria-hidden />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
