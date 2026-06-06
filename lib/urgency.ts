import type { Urgency } from "@/types";

/** Maps an urgency to its token color and a soft tinted background. */
export const URGENCY: Record<
  Urgency,
  { color: string; soft: string; label: string }
> = {
  overdue: { color: "var(--overdue)", soft: "color-mix(in srgb, var(--overdue) 14%, transparent)", label: "Overdue" },
  urgent: { color: "var(--urgent)", soft: "color-mix(in srgb, var(--urgent) 14%, transparent)", label: "Urgent" },
  soon: { color: "var(--soon)", soft: "color-mix(in srgb, var(--soon) 16%, transparent)", label: "Soon" },
  normal: { color: "var(--ink-2)", soft: "color-mix(in srgb, var(--ink-2) 10%, transparent)", label: "Scheduled" },
  info: { color: "var(--info)", soft: "color-mix(in srgb, var(--info) 10%, transparent)", label: "Info" },
};

/** Human countdown from a number of days remaining. */
export function countdownLabel(daysRemaining: number | null): string {
  if (daysRemaining === null) return "No deadline";
  if (daysRemaining < 0)
    return `${Math.abs(daysRemaining)}d overdue`;
  if (daysRemaining === 0) return "Due today";
  if (daysRemaining === 1) return "Due tomorrow";
  return `${daysRemaining}d left`;
}
