"use client";

import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/** Slim top chrome for mobile, where there is no sidebar. */
export function MobileTopBar() {
  return (
    <div
      className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-2.5 backdrop-blur lg:hidden"
      style={{ paddingTop: "max(env(safe-area-inset-top), 0.625rem)" }}
    >
      <Link href="/letters" aria-label="Klar home">
        <Wordmark size="sm" />
      </Link>
      <ThemeToggle />
    </div>
  );
}
