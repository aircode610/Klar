"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, MessageSquareReply, Quote, Square, SquareCheck } from "lucide-react";
import type { ActionItem } from "@/types";
import { DeadlineChip } from "@/components/ui/DeadlineChip";
import { Button } from "@/components/ui/Button";
import { Stamp } from "@/components/brand/Stamp";
import { HighlightText } from "@/components/brand/HighlightText";
import { deadlineView, SEVERITY_META } from "@/lib/adapt";
import { URGENCY } from "@/lib/urgency";
import { cn } from "@/lib/utils";

/**
 * One extracted obligation: the action, its deadline, severity, server-computed
 * risk, the steps to complete it, and the exact German sentence it came from.
 * "Mark done" persists via PATCH /actions/{id}.
 */
export function ObligationCard({
  action,
  primary,
  onMarkDone,
}: {
  action: ActionItem;
  primary?: boolean;
  onMarkDone: (id: string, done: boolean) => Promise<void>;
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const done = action.status === "done";
  const deadline = deadlineView(action.deadline);
  const sev = SEVERITY_META[action.severity];
  const risk = action.risk_score ?? null;

  const toggleDone = async () => {
    setBusy(true);
    try {
      await onMarkDone(action.id, !done);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={cn(
        "rounded-(--radius-lg) border bg-surface p-4",
        done ? "border-line opacity-75" : "border-line",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide"
          style={{ color: URGENCY[sev.urgency].color, backgroundColor: URGENCY[sev.urgency].soft }}
        >
          {sev.label}
        </span>
        {action.reply_needed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[0.65rem] font-medium text-ink-2">
            <MessageSquareReply size={11} aria-hidden /> Reply needed
          </span>
        )}
        <DeadlineChip deadline={deadline} size="sm" className="ms-auto" />
      </div>

      <h3 className="mt-2.5 text-[1.05rem] font-semibold leading-snug text-ink">
        {primary && !done ? <HighlightText>{action.title}</HighlightText> : action.title}
      </h3>
      {action.description && (
        <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">{action.description}</p>
      )}

      {/* Risk bar */}
      {risk !== null && (
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-[0.62rem] uppercase tracking-wide text-ink-2">Risk</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, var(--soon), var(--overdue))" }}
              initial={{ width: 0 }}
              whileInView={{ width: `${risk}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>
          <span className="tabular font-mono text-[0.7rem] font-bold text-ink">{risk}</span>
        </div>
      )}

      {/* Steps checklist */}
      {action.steps && action.steps.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {action.steps.map((step, i) => {
            const on = checked[i];
            return (
              <li key={i}>
                <button
                  onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                  className="flex w-full items-start gap-2 text-start"
                >
                  {on ? (
                    <SquareCheck size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-done" aria-hidden />
                  ) : (
                    <Square size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
                  )}
                  <span className={cn("text-[0.875rem] text-ink", on && "text-ink-2 line-through")}>
                    {step}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Evidence span */}
      {action.evidence_span && (
        <div className="mt-3 flex gap-2 rounded-(--radius-md) bg-surface-2 px-3 py-2">
          <Quote size={13} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
          <p className="font-mono text-[0.72rem] leading-relaxed text-ink-2">
            {action.evidence_span}
          </p>
        </div>
      )}

      <div className="mt-3.5 flex items-center gap-2">
        {done ? (
          <>
            <Stamp label="DONE" tone="done" size="sm" />
            <Button size="sm" variant="ghost" onClick={toggleDone} disabled={busy} className="ms-auto">
              Reopen
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={toggleDone} disabled={busy} className="ms-auto">
            <Check size={15} strokeWidth={2.5} aria-hidden /> Mark done
          </Button>
        )}
      </div>
    </section>
  );
}
