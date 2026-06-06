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
 *
 * Visual styling matches ExpandableSection's tone="default" card so the
 * detail page reads as one consistent stack.
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

  const completed = items.reduce((acc, _, i) => acc + (checked[i] ? 1 : 0), 0);

  return (
    <section className="overflow-hidden rounded-(--radius-lg) border border-line bg-surface transition-colors hover:border-ink/20">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3.5">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-md) ring-1 ring-inset"
            style={{
              backgroundColor: "color-mix(in srgb, var(--ink) 6%, transparent)",
              color: "var(--ink)",
              // @ts-expect-error — Tailwind passes through to ring-color via the var.
              "--tw-ring-color": "color-mix(in srgb, var(--ink) 12%, transparent)",
            }}
          >
            <ClipboardList size={17} strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-[0.95rem] font-semibold leading-snug tracking-tight text-ink">
              {title}
            </h3>
            <p className="mt-1 font-mono text-[0.72rem] tabular text-ink-2">
              {completed}/{items.length}
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-1">
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
                  className="group/row flex w-full items-start gap-3 rounded-(--radius-md) px-2 py-2 text-start transition-colors hover:bg-ink/[0.04]"
                >
                  {on ? (
                    <SquareCheck
                      size={19}
                      strokeWidth={2}
                      className="mt-0.5 shrink-0 text-done"
                      aria-hidden
                    />
                  ) : (
                    <Square
                      size={19}
                      strokeWidth={1.75}
                      className="mt-0.5 shrink-0 text-ink-2 transition-colors group-hover/row:text-ink"
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      "flex-1 text-[0.95rem] leading-relaxed text-ink transition-colors",
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
    </section>
  );
}
