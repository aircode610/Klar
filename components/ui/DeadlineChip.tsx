import { cn } from "@/lib/utils";
import type { Deadline } from "@/types";
import { URGENCY, countdownLabel } from "@/lib/urgency";

/**
 * Mono countdown + urgency colour. The recurring "how much time is left" device.
 */
export function DeadlineChip({
  deadline,
  size = "md",
  className,
}: {
  deadline: Deadline | null;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!deadline || deadline.date === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-ink-2",
          size === "sm" ? "text-[0.7rem]" : "text-xs",
          className,
        )}
      >
        No deadline
      </span>
    );
  }

  const u = URGENCY[deadline.urgency];
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono font-bold",
        size === "sm" ? "text-[0.7rem]" : "text-xs",
        className,
      )}
      style={{ color: u.color, backgroundColor: u.soft }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: u.color }} aria-hidden />
      {countdownLabel(deadline.daysRemaining)}
    </span>
  );
}
