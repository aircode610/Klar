"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Coins,
  MessageSquareReply,
  Pencil,
  Quote,
  Square,
  SquareCheck,
  X,
} from "lucide-react";
import type { ActionItem } from "@/types";
import { DeadlineChip } from "@/components/ui/DeadlineChip";
import { Button } from "@/components/ui/Button";
import { Stamp } from "@/components/brand/Stamp";
import { HighlightText } from "@/components/brand/HighlightText";
import { deadlineView, SEVERITY_META } from "@/lib/adapt";
import { URGENCY } from "@/lib/urgency";
import { downloadICS } from "@/lib/ics";
import { requestReminder } from "@/lib/notify";
import { toast } from "@/components/ui/Toast";
import { cn, formatEur } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

export function ObligationCard({
  action,
  primary,
  institution,
  onMarkDone,
  onEdit,
}: {
  action: ActionItem;
  primary?: boolean;
  institution: string;
  onMarkDone: (id: string, done: boolean) => Promise<void>;
  onEdit: (id: string, patch: { title?: string; deadline?: string }) => Promise<void>;
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [showRisk, setShowRisk] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(action.title);
  const [draftDeadline, setDraftDeadline] = useState(action.deadline ?? "");
  const [remindOn, setRemindOn] = useState(false);
  const lang = useAppStore((s) => s.lang);

  const done = action.status === "done";
  const amount = action.amount_due_eur ?? 0;
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

  const saveEdit = async () => {
    setBusy(true);
    try {
      await onEdit(action.id, {
        title: draftTitle,
        deadline: draftDeadline || undefined,
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const addToCalendar = () => {
    if (!action.deadline) return;
    downloadICS({
      title: action.title,
      date: action.deadline,
      description: `${institution} — ${action.description ?? ""}`.trim(),
    });
    toast.success("Calendar event downloaded (.ics).");
  };

  const remind = async () => {
    const r = await requestReminder(action.title);
    if (r === "granted") {
      setRemindOn(true);
      toast.success("Reminder set — we'll nudge you before the deadline.");
    } else if (r === "denied") {
      toast.info("Allow notifications to get reminders.");
    } else {
      toast.info("Reminders aren't supported on this device.");
    }
  };

  return (
    <section className={cn("rounded-(--radius-lg) border border-line bg-surface p-4", done && "opacity-75")}>
      {/* top row */}
      <div className="flex flex-wrap items-center gap-2">
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
        {amount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[0.7rem] font-semibold tabular text-ink"
            style={{ backgroundColor: "color-mix(in srgb, var(--overdue) 12%, transparent)" }}
            title="Outstanding amount"
          >
            <Coins size={11} strokeWidth={2} aria-hidden /> {formatEur(amount, lang)}
          </span>
        )}
        <DeadlineChip deadline={deadline} size="sm" className="ms-auto" />
        {!done && (
          <button
            onClick={() => setEditing((e) => !e)}
            aria-label="Edit obligation"
            className="rounded-full p-1 text-ink-2 hover:text-ink"
          >
            {editing ? <X size={16} /> : <Pencil size={15} />}
          </button>
        )}
      </div>

      {/* title / edit */}
      {editing ? (
        <div className="mt-2.5 space-y-2">
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="w-full rounded-(--radius-md) border border-line bg-surface-2 px-3 py-2 text-[0.95rem] text-ink outline-none focus:border-ink/40"
          />
          <div className="flex items-center gap-2">
            <label className="font-mono text-[0.62rem] uppercase tracking-wide text-ink-2">Deadline</label>
            <input
              type="date"
              value={draftDeadline}
              onChange={(e) => setDraftDeadline(e.target.value)}
              className="rounded-(--radius-md) border border-line bg-surface-2 px-2 py-1.5 text-[0.85rem] text-ink outline-none focus:border-ink/40"
            />
            <Button size="sm" className="ms-auto" onClick={saveEdit} disabled={busy}>
              Save
            </Button>
          </div>
          <p className="text-[0.7rem] text-ink-2">
            Your correction is saved and helps Klar read letters like this better.
          </p>
        </div>
      ) : (
        <h3 className="mt-2.5 text-[1.05rem] font-semibold leading-snug text-ink">
          {primary && !done ? <HighlightText>{action.title}</HighlightText> : action.title}
        </h3>
      )}
      {!editing && action.description && (
        <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">{action.description}</p>
      )}

      {/* risk bar (click to explain) */}
      {risk !== null && (
        <div className="mt-3">
          <button onClick={() => setShowRisk((s) => !s)} className="flex w-full items-center gap-2">
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
            <ChevronDown size={14} className={cn("text-ink-2 transition-transform", showRisk && "rotate-180")} aria-hidden />
          </button>
          <AnimatePresence>
            {showRisk && action.risk && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2.5 space-y-1.5 rounded-(--radius-md) bg-surface-2 p-3">
                  <p className="mb-1 text-[0.72rem] text-ink-2">Why this score:</p>
                  <RiskFactor label="Deadline proximity" value={action.risk.deadline_proximity_pts} weight={0.4} />
                  <RiskFactor label="Who sent it" value={action.risk.institution_weight} weight={0.3} />
                  <RiskFactor label="Severity" value={action.risk.severity_pts} weight={0.2} />
                  <RiskFactor label="Missing info" value={action.risk.missing_info_penalty} weight={0.1} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* steps */}
      {!editing && action.steps && action.steps.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {action.steps.map((step, i) => {
            const on = checked[i];
            return (
              <li key={i}>
                <button onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))} className="flex w-full items-start gap-2 text-start">
                  {on ? (
                    <SquareCheck size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-done" aria-hidden />
                  ) : (
                    <Square size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
                  )}
                  <span className={cn("text-[0.875rem] text-ink", on && "text-ink-2 line-through")}>{step}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* evidence */}
      {!editing && action.evidence_span && (
        <div className="mt-3 flex gap-2 rounded-(--radius-md) bg-surface-2 px-3 py-2">
          <Quote size={13} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
          <p className="font-mono text-[0.72rem] leading-relaxed text-ink-2">{action.evidence_span}</p>
        </div>
      )}

      {/* action toolbar */}
      {!editing && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {action.deadline && (
            <>
              <Button size="sm" variant="ghost" onClick={addToCalendar}>
                <CalendarPlus size={15} strokeWidth={2} /> Calendar
              </Button>
              <Button size="sm" variant="ghost" onClick={remind} disabled={remindOn}>
                <Check size={15} strokeWidth={2} className={remindOn ? "" : "hidden"} />
                {remindOn ? "Reminder on" : "Remind me"}
              </Button>
            </>
          )}
          {done ? (
            <div className="ms-auto flex items-center gap-2">
              <Stamp label="DONE" tone="done" size="sm" />
              <Button size="sm" variant="ghost" onClick={toggleDone} disabled={busy}>
                Reopen
              </Button>
            </div>
          ) : (
            <Button size="sm" className="ms-auto" onClick={toggleDone} disabled={busy}>
              <Check size={15} strokeWidth={2.5} aria-hidden /> Mark done
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function RiskFactor({ label, value, weight }: { label: string; value: number; weight: number }) {
  const pts = Math.round(value * weight * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[0.72rem] text-ink-2">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-ink/40" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="tabular w-12 text-end font-mono text-[0.62rem] text-ink-2">
        +{pts} <span className="opacity-60">·{Math.round(weight * 100)}%</span>
      </span>
    </div>
  );
}
