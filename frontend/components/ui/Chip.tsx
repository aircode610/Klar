import { cn } from "@/lib/utils";
import type { Urgency } from "@/types";
import { URGENCY } from "@/lib/urgency";

/** Small pill. Neutral by default, or tinted by urgency. */
export function Chip({
  urgency,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { urgency?: Urgency }) {
  const u = urgency ? URGENCY[urgency] : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-medium",
        !u && "border-line bg-surface-2 text-ink-2",
        className,
      )}
      style={
        u
          ? { color: u.color, backgroundColor: u.soft, borderColor: "transparent" }
          : undefined
      }
      {...props}
    >
      {u && (
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: u.color }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
