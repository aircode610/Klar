"use client";

import { useState } from "react";
import { ClipboardList, Square, SquareCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Always-visible "bring these documents" tick-box list. Distinct from the
 * other long-form detail sections that hide behind ExpandableSection — the
 * checklist is short, action-oriented, and the user is most likely to want
 * to glance at it without an extra click.
 *
 * Tick state is purely local (session-scoped). The backend has no
 * per-item completion API; this is a "scratchpad" affordance so the user
 * can mark off items as they prepare them.
 */
export function DocumentChecklist({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  if (items.length === 0) return null;

  return (
    <div className="rounded-(--radius-lg) border border-line bg-surface px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <ClipboardList
          size={17}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0 text-ink-2"
          aria-hidden
        />
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.08em] text-ink-2">
          {title}
        </h3>
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((item, i) => {
          const on = checked[i];
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() =>
                  setChecked((c) => ({ ...c, [i]: !c[i] }))
                }
                aria-pressed={!!on}
                className="flex w-full items-start gap-2 text-start"
              >
                {on ? (
                  <SquareCheck
                    size={18}
                    strokeWidth={2}
                    className="mt-0.5 shrink-0 text-done"
                    aria-hidden
                  />
                ) : (
                  <Square
                    size={18}
                    strokeWidth={1.75}
                    className="mt-0.5 shrink-0 text-ink-2"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "text-[0.92rem] leading-snug text-ink",
                    on && "text-ink-2 line-through",
                  )}
                >
                  {item}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
