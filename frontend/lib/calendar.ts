/** Small date helpers for the calendar (no date library). Week starts Monday. */

export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** 0 = Monday … 6 = Sunday */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatMonthYear(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDayLong(d: Date): string {
  const wd = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    d.getDay()
  ];
  return `${wd} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Builds a 6-row (42-cell) month grid including trailing/leading days from the
 * neighbouring months, the way a calendar grid looks.
 */
export function monthGrid(month: Date): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(month);
  const offset = mondayIndex(first);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(first.getFullYear(), first.getMonth(), 1 - offset + i);
    cells.push({ date, inMonth: date.getMonth() === month.getMonth() });
  }
  return cells;
}
