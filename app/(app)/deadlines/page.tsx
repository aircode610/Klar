"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CalendarPlus, Check, ChevronRight } from "lucide-react";
import { useActions } from "@/lib/hooks";
import * as api from "@/lib/api";
import { Screen, PageHeader } from "@/components/ui/Screen";
import { Calendar } from "@/components/screens/calendar/Calendar";
import { DeadlineChip } from "@/components/ui/DeadlineChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toast";
import { CALENDAR_APPOINTMENTS } from "@/lib/data/prototype";
import { downloadICS } from "@/lib/ics";
import { deadlineView, daysUntil, urgencyFromDays, SEVERITY_META } from "@/lib/adapt";
import { URGENCY } from "@/lib/urgency";
import type { CalendarEvent } from "@/types/extra";

export default function DeadlinesPage() {
  const { data, loading, reload } = useActions();
  const [doneIds, setDoneIds] = useState<Record<string, boolean>>({});

  const dated = useMemo(
    () => (data ?? []).filter((a) => a.deadline),
    [data],
  );

  const events: CalendarEvent[] = useMemo(() => {
    const fromActions: CalendarEvent[] = dated.map((a) => ({
      id: `dl_${a.id}`,
      letterId: a.letter_id,
      title: a.title,
      date: `${a.deadline}T09:00:00`,
      kind: "deadline",
      urgency: urgencyFromDays(daysUntil(a.deadline)),
    }));
    return [...fromActions, ...CALENDAR_APPOINTMENTS];
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
