"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";
import type { Letter } from "@/types";
import { Card } from "@/components/ui/Card";
import { DeadlineChip } from "@/components/ui/DeadlineChip";
import { Stamp } from "@/components/brand/Stamp";
import { letterIcon } from "@/lib/letter-visuals";
import { URGENCY } from "@/lib/urgency";

/** A paper card summarising one letter. Links to its detail screen. */
export function LetterCard({ letter, index = 0 }: { letter: Letter; index?: number }) {
  const reduce = useReducedMotion();
  const Icon = letterIcon(letter);
  const accent = letter.deadline ? URGENCY[letter.deadline.urgency].color : "var(--ink-2)";

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.05, 0.3) }}
    >
      <Link href={`/letters/${letter.id}`} className="block">
        <Card grain className="group p-4 transition-colors hover:border-ink/25">
          <div className="flex items-start gap-3.5">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface-2"
              style={{ color: accent }}
            >
              <Icon size={21} strokeWidth={1.75} aria-hidden />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-[0.7rem] uppercase tracking-wide text-ink-2">
                  {letter.sender}
                </span>
                {letter.handled && <Stamp label="KLAR" tone="done" size="sm" animate={false} className="ms-auto" />}
              </div>

              <h3 className="mt-0.5 truncate text-[1.05rem] font-semibold text-ink">
                {letter.documentType}
              </h3>
              <p className="mt-1 line-clamp-2 text-[0.875rem] leading-snug text-ink-2">
                {letter.summary}
              </p>

              <div className="mt-3 flex items-center gap-2">
                {!letter.handled && <DeadlineChip deadline={letter.deadline} size="sm" />}
                {letter.referenceNumber && (
                  <span className="truncate font-mono text-[0.68rem] text-ink-2/70">
                    {letter.referenceNumber}
                  </span>
                )}
                <ChevronRight
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                  className="ms-auto shrink-0 text-ink-2 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                />
              </div>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
