"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import type { CalendarEvent } from "@/types/extra";
import { URGENCY } from "@/lib/urgency";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  WEEKDAYS_SHORT,
  addMonths,
  formatDayLong,
  formatMonthYear,
  formatTime,
  isSameDay,
  monthGrid,
  startOfMonth,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

const HOUR_H = 56;

/** iPhone-style calendar: a month grid up top, a day timeline below. */
export function Calendar({ events }: { events: CalendarEvent[] }) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [view, setView] = useState<"month" | "day">("month");

  const grid = useMemo(() => monthGrid(month), [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const selectedEvents = (eventsByDay.get(dayKey(selected)) ?? []).sort(
    (a, b) => +new Date(a.date) - +new Date(b.date),
  );

  const goToday = () => {
    const now = new Date();
    setMonth(startOfMonth(now));
    setSelected(now);
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2
          className="text-[1.15rem] font-bold text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {formatMonthYear(month)}
        </h2>
        <button
          onClick={goToday}
          className="ms-1 rounded-full border border-line px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-wide text-ink-2 hover:text-ink"
        >
          Today
        </button>
        <div className="ms-auto flex items-center gap-1">
          <SegmentedControl
            options={[
              { value: "month", label: "Month" },
              { value: "day", label: "Day" },
            ]}
            value={view}
            onChange={setView}
          />
          <button
            onClick={() => setMonth((m) => addMonths(m, -1))}
            aria-label="Previous month"
            className="rounded-full p-1.5 text-ink-2 hover:bg-ink/[0.06] hover:text-ink"
          >
            <ChevronLeft size={20} className="rtl:rotate-180" />
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
            className="rounded-full p-1.5 text-ink-2 hover:bg-ink/[0.06] hover:text-ink"
          >
            <ChevronRight size={20} className="rtl:rotate-180" />
          </button>
        </div>
      </div>

      {view === "month" && (
        <MonthGrid
          grid={grid}
          today={today}
          selected={selected}
          onSelect={(d) => {
            setSelected(d);
            if (d.getMonth() !== month.getMonth()) setMonth(startOfMonth(d));
          }}
          eventsByDay={eventsByDay}
          dayKey={dayKey}
        />
      )}

      {/* Selected day header */}
      <div className="flex items-center justify-between border-y border-line bg-surface-2/50 px-4 py-2.5">
        <span className="text-[0.9rem] font-semibold text-ink">{formatDayLong(selected)}</span>
        <span className="font-mono text-[0.7rem] text-ink-2">
          {selectedEvents.length} {selectedEvents.length === 1 ? "event" : "events"}
        </span>
      </div>

      <DayTimeline day={selected} events={selectedEvents} today={today} />
    </div>
  );
}

function MonthGrid({
  grid,
  today,
  selected,
  onSelect,
  eventsByDay,
  dayKey,
}: {
  grid: { date: Date; inMonth: boolean }[];
  today: Date;
  selected: Date;
  onSelect: (d: Date) => void;
  eventsByDay: Map<string, CalendarEvent[]>;
  dayKey: (d: Date) => string;
}) {
  return (
    <div className="px-2 pt-2">
      <div className="grid grid-cols-7">
        {WEEKDAYS_SHORT.map((w) => (
          <div
            key={w}
            className="pb-1.5 text-center font-mono text-[0.6rem] uppercase tracking-wide text-ink-2"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map(({ date, inMonth }, i) => {
          const isToday = isSameDay(date, today);
          const isSelected = isSameDay(date, selected);
          const dayEvents = eventsByDay.get(dayKey(date)) ?? [];
          return (
            <button
              key={i}
              onClick={() => onSelect(date)}
              className="flex flex-col items-center py-1.5"
            >
              <span
                className={cn(
                  "tabular flex size-8 items-center justify-center rounded-full text-[0.85rem]",
                  isSelected && "bg-ink font-semibold text-bg",
                  !isSelected && isToday && "font-bold text-brand-ink",
                  !isSelected && !isToday && inMonth && "text-ink",
                  !isSelected && !inMonth && "text-ink-2/40",
                )}
                style={
                  !isSelected && isToday
                    ? { backgroundColor: "var(--brand)" }
                    : undefined
                }
              >
                {date.getDate()}
              </span>
              <span className="mt-1 flex h-1.5 items-center gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: URGENCY[e.urgency].color }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayTimeline({
  day,
  events,
  today,
}: {
  day: Date;
  events: CalendarEvent[];
  today: Date;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isToday = isSameDay(day, today);

  // Auto-scroll to the first event, or 8:00.
  useEffect(() => {
    const first = events[0];
    const hour = first ? new Date(first.date).getHours() : 8;
    scrollRef.current?.scrollTo({ top: Math.max(0, (hour - 1) * HOUR_H) });
  }, [day, events]);

  const nowTop = isToday
    ? (today.getHours() + today.getMinutes() / 60) * HOUR_H
    : null;

  return (
    <div ref={scrollRef} className="max-h-[440px] overflow-y-auto">
      <div className="relative" style={{ height: 24 * HOUR_H }}>
        {/* hour lines */}
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="absolute inset-x-0 flex"
            style={{ top: h * HOUR_H, height: HOUR_H }}
          >
            <span className="w-12 shrink-0 -translate-y-2 ps-3 font-mono text-[0.62rem] text-ink-2">
              {h.toString().padStart(2, "0")}:00
            </span>
            <span className="mt-0 h-px flex-1 self-start bg-line" />
          </div>
        ))}

        {/* now line */}
        {nowTop !== null && (
          <div className="absolute inset-x-0 z-20 flex items-center" style={{ top: nowTop }}>
            <span className="ms-11 size-2 rounded-full bg-overdue" />
            <span className="h-px flex-1 bg-overdue" />
          </div>
        )}

        {/* events */}
        {events.map((e) => {
          const d = new Date(e.date);
          const top = (d.getHours() + d.getMinutes() / 60) * HOUR_H;
          const height = Math.max(34, ((e.durationMins ?? 30) / 60) * HOUR_H);
          const u = URGENCY[e.urgency];
          return (
            <motion.button
              key={e.id}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => e.letterId && router.push(`/letters/${e.letterId}`)}
              className={cn(
                "absolute end-2 start-14 z-10 overflow-hidden rounded-[8px] border-s-[3px] px-2.5 py-1 text-start",
                e.letterId ? "cursor-pointer" : "cursor-default",
              )}
              style={{
                top: top + 1,
                height: height - 2,
                borderInlineStartColor: u.color,
                backgroundColor: u.soft,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[0.62rem]" style={{ color: u.color }}>
                  {formatTime(e.date)}
                </span>
                <span className="truncate text-[0.78rem] font-semibold text-ink">
                  {e.title}
                </span>
              </div>
              {e.location && height > 44 && (
                <span className="mt-0.5 flex items-center gap-1 truncate text-[0.68rem] text-ink-2">
                  <MapPin size={10} aria-hidden /> {e.location}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
