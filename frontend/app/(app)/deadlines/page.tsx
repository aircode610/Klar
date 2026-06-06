"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CalendarPlus, Check, ChevronRight } from "lucide-react";
import { useActions } from "@/lib/hooks";
import * as api from "@/lib/api";
import { Screen, PageHeader } from "@/components/ui/Screen";
import { Calendar } from "@/components/screens/calendar/Calendar";
import { Card } from "@/components/ui/Card";
import { DeadlineChip } from "@/components/ui/DeadlineChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toast";
import { downloadICS } from "@/lib/ics";
import { deadlineView, daysUntil, urgencyFromDays, SEVERITY_META } from "@/lib/adapt";
import { URGENCY } from "@/lib/urgency";
import { formatEur } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { getDictionary } from "@/lib/i18n";
import type { CalendarEvent } from "@/types/extra";

export default function DeadlinesPage() {
  const { data, loading, reload } = useActions();
  const [doneIds, setDoneIds] = useState<Record<string, boolean>>({});
  const lang = useAppStore((s) => s.lang);
  const d = getDictionary(lang);

  const dated = useMemo(
    () => (data ?? []).filter((a) => a.deadline),
    [data],
  );

  // Sum of outstanding amounts across all open dated actions. Marked-done
  // (either server-side or optimistically in this session) are excluded.
  const totalOutstanding = useMemo(
    () =>
      (data ?? []).reduce((acc, a) => {
        if (a.status === "done" || a.status === "ignored") return acc;
        if (doneIds[a.id]) return acc;
        return acc + (a.amount_due_eur ?? 0);
      }, 0),
    [data, doneIds],
  );

  const events: CalendarEvent[] = useMemo(() => {
    return dated.map((a) => ({
      id: `dl_${a.id}`,
      letterId: a.letter_id,
      title: a.title,
      date: `${a.deadline}T09:00:00`,
      kind: "deadline" as const,
      urgency: urgencyFromDays(daysUntil(a.deadline)),
    }));
  }, [dated]);

  const markDone = async (id: string) => {
    setDoneIds((s) => ({ ...s, [id]: true }));
    try {
      await api.updateAction(id, { status: "done" });
      toast.success("Marked done. Klar.");
      reload();
    } catch {
      setDoneIds((s) => ({ ...s, [id]: false }));
      toast.error("Couldn't update that.");
    }
  };

  return (
    <Screen width="wide">
      <PageHeader eyebrow="Calendar" title="Nothing slips past you" />

      {totalOutstanding > 0 && (
        <Card className="mb-4 flex items-center justify-between px-4 py-3">
          <span className="font-mono text-[0.7rem] uppercase tracking-wide text-ink-2">
            {d.home.outstanding}
          </span>
          <span
            className="tabular text-xl font-bold text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {formatEur(totalOutstanding, lang)}
          </span>
        </Card>
      )}

      {loading ? (
        <div className="h-[520px] animate-pulse rounded-(--radius-lg) bg-surface-2" />
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No deadlines yet"
          body="When a letter has a date, its obligation lands here automatically."
        />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
          <Calendar events={events} />

          {/* Agenda */}
          <section className="mt-6 lg:mt-0">
            <h2 className="mb-2.5 font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
              Upcoming
            </h2>
            <div className="space-y-2.5">
              {dated
                .filter((a) => !doneIds[a.id])
                .map((a) => {
                  const dv = deadlineView(a.deadline);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-(--radius-lg) border border-line bg-surface p-3"
                    >
                      <span
                        className="h-9 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: URGENCY[SEVERITY_META[a.severity].urgency].color }}
                        aria-hidden
                      />
                      <Link href={`/letters/${a.letter_id}`} className="min-w-0 flex-1">
                        <p className="truncate text-[0.9rem] font-semibold text-ink">{a.title}</p>
                        <p className="truncate font-mono text-[0.68rem] uppercase tracking-wide text-ink-2">
                          {SEVERITY_META[a.severity].label} severity
                        </p>
                      </Link>
                      {a.amount_due_eur && a.amount_due_eur > 0 && (
                        <span
                          className="shrink-0 rounded-(--radius-sm) bg-surface-2 px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold tabular text-ink"
                          title={d.home.outstanding}
                        >
                          {formatEur(a.amount_due_eur, lang)}
                        </span>
                      )}
                      <DeadlineChip deadline={dv} size="sm" />
                      <button
                        onClick={() =>
                          a.deadline && downloadICS({ title: a.title, date: a.deadline })
                        }
                        aria-label="Add to calendar"
                        className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-md) border border-line bg-surface-2 text-ink-2 transition-colors hover:text-ink"
                      >
                        <CalendarPlus size={16} strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => markDone(a.id)}
                        aria-label="Mark done"
                        className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-md) border border-line bg-surface-2 text-ink-2 transition-colors hover:text-done"
                      >
                        <Check size={16} strokeWidth={2.25} />
                      </button>
                    </div>
                  );
                })}
              <Link
                href="/letters"
                className="flex items-center justify-center gap-1.5 rounded-(--radius-lg) border border-dashed border-line py-3 text-[0.85rem] text-ink-2 hover:text-ink"
              >
                See all letters
                <ChevronRight size={15} className="rtl:rotate-180" aria-hidden />
              </Link>
            </div>
          </section>
        </div>
      )}
    </Screen>
  );
}
