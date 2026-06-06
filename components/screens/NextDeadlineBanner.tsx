"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import type { Letter } from "@/types";
import { DeadlineChip } from "@/components/ui/DeadlineChip";
import { URGENCY } from "@/lib/urgency";

/** Calm hero banner for the single most pressing deadline on the home screen. */
export function NextDeadlineBanner({ letter }: { letter: Letter }) {
  const u = letter.deadline ? URGENCY[letter.deadline.urgency] : null;
  return (
    <Link
      href={`/letters/${letter.id}`}
      className="block overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface"
    >
      <div className="h-1 w-full" style={{ backgroundColor: u?.color ?? "var(--ink-2)" }} />
      <div className="card-grain relative p-5">
        <div className="flex items-center gap-2 text-ink-2">
          <CalendarClock size={16} strokeWidth={1.75} aria-hidden />
          <span className="font-mono text-xs uppercase tracking-[0.08em]">
            Your next deadline
          </span>
          <DeadlineChip deadline={letter.deadline} size="sm" className="ms-auto" />
        </div>

        <h2
          className="mt-3 text-[1.3rem] font-bold leading-snug text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {letter.deadline?.label}
        </h2>
        <p className="mt-1 text-[0.9rem] text-ink-2">
          {letter.sender} · {letter.documentType}
        </p>

        <div className="mt-4 inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-ink">
          Open this letter
          <ArrowRight size={16} strokeWidth={2.25} aria-hidden className="rtl:rotate-180" />
        </div>
      </div>
    </Link>
  );
}
