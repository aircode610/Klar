"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, CalendarDays, ChevronRight } from "lucide-react";
import { useDeadlines } from "@/lib/hooks";
import * as api from "@/lib/api";
import { Screen, PageHeader } from "@/components/ui/Screen";
import { Calendar } from "@/components/screens/calendar/Calendar";
import { DeadlineChip } from "@/components/ui/DeadlineChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toast";
import { CALENDAR_APPOINTMENTS } from "@/lib/data/prototype";
import { URGENCY } from "@/lib/urgency";
import type { CalendarEvent } from "@/types/extra";

export default function DeadlinesPage() {
  const { data, loading } = useDeadlines();
  const [reminders, setReminders] = useState<Record<string, boolean>>({});

  const deadlineItems = useMemo(() => data?.items ?? [], [data]);

  const events: CalendarEvent[] = useMemo(() => {
    const fromDeadlines: CalendarEvent[] = deadlineItems
      .filter((it) => it.deadline.date)
      .map((it) => ({
        id: `dl_${it.letterId}`,
        letterId: it.letterId,
        title: it.deadline.label,
        date: it.deadline.date as string,
        kind: "deadline",
        urgency: it.deadline.urgency,
      }));
    return [...fromDeadlines, ...CALENDAR_APPOINTMENTS];
  }, [deadlineItems]);

  const toggle = (letterId: string) => {
    const next = !reminders[letterId];
    setReminders((r) => ({ ...r, [letterId]: next }));
    void api.setReminder(letterId, next).catch(() => {});
    toast.success(next ? "Reminder set." : "Reminder removed.");
  };

  return (
    <Screen width="wide">
      <PageHeader eyebrow="Calendar" title="Nothing slips past you" />

      {loading ? (
        <div className="h-[520px] animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No deadlines yet"
          body="When a letter has a date, it lands here automatically."
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
              {deadlineItems.map((it) => {
                const on = reminders[it.letterId];
                return (
                  <div
                    key={it.letterId}
                    className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-3"
                  >
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: URGENCY[it.deadline.urgency].color }}
                      aria-hidden
                    />
                    <Link href={`/letters/${it.letterId}`} className="min-w-0 flex-1">
                      <p className="truncate text-[0.9rem] font-semibold text-ink">
                        {it.deadline.label}
                      </p>
                      <p className="truncate font-mono text-[0.68rem] uppercase tracking-wide text-ink-2">
                        {it.sender}
                      </p>
                    </Link>
                    <DeadlineChip deadline={it.deadline} size="sm" />
                    <button
                      onClick={() => toggle(it.letterId)}
                      aria-pressed={on}
                      aria-label="Toggle reminder"
                      className={`flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border transition-colors ${
                        on
                          ? "border-ink bg-ink text-bg"
                          : "border-line bg-surface-2 text-ink-2 hover:text-ink"
                      }`}
                    >
                      {on ? <BellRing size={16} /> : <Bell size={16} />}
                    </button>
                  </div>
                );
              })}
              <Link
                href="/letters"
                className="flex items-center justify-center gap-1.5 rounded-[var(--radius-lg)] border border-dashed border-line py-3 text-[0.85rem] text-ink-2 hover:text-ink"
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
