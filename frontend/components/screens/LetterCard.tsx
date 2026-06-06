"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight, Loader2 } from "lucide-react";
import type { LetterListItem } from "@/types";
import { Card } from "@/components/ui/Card";
import { DeadlineChip } from "@/components/ui/DeadlineChip";
import { CATEGORY_LABEL, categoryIcon, deadlineView, riskMeta } from "@/lib/adapt";
import { URGENCY } from "@/lib/urgency";

/** A compact paper card for one letter (GET /api/letters row). */
export function LetterCard({ item, index = 0 }: { item: LetterListItem; index?: number }) {
  const reduce = useReducedMotion();
  const Icon = categoryIcon(item.category);
  const rm = riskMeta(item.risk_score);
  const processing = item.status === "uploaded" || item.status === "processing";
  const accent = URGENCY[rm.urgency].color;

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.05, 0.3) }}
    >
      <Link href={`/letters/${item.id}`} className="block">
        <Card grain className="group p-4 transition-colors hover:border-ink/25">
          <div className="flex items-center gap-3.5">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-(--radius-md) border border-line bg-surface-2"
              style={{ color: accent }}
            >
              <Icon size={21} strokeWidth={1.75} aria-hidden />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-[0.68rem] uppercase tracking-wide text-ink-2">
                  {CATEGORY_LABEL[item.category]}
                </span>
                {processing ? (
                  <span className="ms-auto inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-wide text-ink-2">
                    <Loader2 size={11} className="animate-spin" /> Reading
                  </span>
                ) : item.status === "error" ? (
                  <span className="ms-auto font-mono text-[0.62rem] uppercase tracking-wide text-overdue">
                    Failed
                  </span>
                ) : (
                  <span
                    className="ms-auto rounded-full px-2 py-0.5 font-mono text-[0.62rem] font-bold"
                    style={{ color: rm.urgency === "normal" ? "var(--ink-2)" : accent }}
                  >
                    Risk {item.risk_score}
                  </span>
                )}
              </div>

              <h3 className="mt-0.5 truncate text-[1.05rem] font-semibold text-ink">
                {item.letter_type}
              </h3>

              <div className="mt-2 flex items-center gap-2">
                <DeadlineChip deadline={deadlineView(item.deadline_date)} size="sm" />
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
