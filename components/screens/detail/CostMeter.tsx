"use client";

import { motion } from "motion/react";
import { TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { COST_MODEL } from "@/lib/data/prototype";

/**
 * "Cost of ignoring" meter — shows the amount due now, how fast it grows, and
 * when it becomes enforceable. Makes the consequence visceral. Prototype data.
 */
export function CostMeter({ letterId }: { letterId: string }) {
  const model = COST_MODEL[letterId];
  if (!model) return null;

  const pct = Math.min(100, Math.round((model.current / model.ceiling) * 100));

  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} strokeWidth={2} className="text-urgent" aria-hidden />
        <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
          Cost of ignoring
        </span>
        <span className="ms-auto font-mono text-[0.7rem] text-ink-2">
          +{formatMoney({ amount: model.perWeek, currency: "EUR" })}/week
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className="tabular text-3xl font-bold text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {formatMoney({ amount: model.current, currency: "EUR" })}
        </span>
        <span className="text-[0.8rem] text-ink-2">due now</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, var(--soon), var(--overdue))" }}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <p className="mt-2.5 text-[0.8rem] text-ink-2">
        Becomes enforceable in{" "}
        <span className="font-semibold text-ink">{model.enforceableInDays} days</span> —
        then a collection order can be issued.
      </p>
    </div>
  );
}
