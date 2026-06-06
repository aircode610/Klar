"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Editorial segmented control with a sliding ink-paper thumb. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-[var(--radius-md)] border border-line bg-surface-2 p-0.5",
        className,
      )}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-[calc(var(--radius-md)-2px)] px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
              active ? "text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId="segmented-thumb"
                className="absolute inset-0 rounded-[calc(var(--radius-md)-2px)] border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
