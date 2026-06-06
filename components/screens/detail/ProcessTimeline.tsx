"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROCESS_STEPS } from "@/lib/data/prototype";

/**
 * "What comes next" — an anticipatory map of the bureaucratic process this letter
 * is part of, so the user knows where they are and what follows. Prototype data.
 */
export function ProcessTimeline({ letterId }: { letterId: string }) {
  const steps = PROCESS_STEPS[letterId];
  if (!steps) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
      <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
        What comes next
      </span>
      <ol className="mt-3.5 space-y-0">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={s.id} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && (
                <span
                  className={cn(
                    "absolute start-[11px] top-6 h-[calc(100%-1rem)] w-px",
                    s.state === "done" ? "bg-done/40" : "bg-line",
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.6rem] font-bold",
                  s.state === "done" && "border-done bg-done text-white",
                  s.state === "current" && "border-ink bg-brand text-brand-ink",
                  s.state === "upcoming" && "border-line bg-surface-2 text-ink-2",
                )}
              >
                {s.state === "done" ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[0.9rem] font-semibold",
                      s.state === "upcoming" ? "text-ink-2" : "text-ink",
                    )}
                  >
                    {s.title}
                  </span>
                  {s.whenHint && (
                    <span className="font-mono text-[0.65rem] text-ink-2">{s.whenHint}</span>
                  )}
                </div>
                <p className="text-[0.82rem] text-ink-2">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
