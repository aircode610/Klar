import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-line bg-surface/60 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-2">
          <Icon size={24} strokeWidth={1.75} aria-hidden />
        </div>
      )}
      <h3 className="text-[1.0625rem] font-semibold text-ink">{title}</h3>
      {body && (
        <p className="mt-1.5 max-w-xs text-[0.875rem] leading-relaxed text-ink-2">
          {body}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
