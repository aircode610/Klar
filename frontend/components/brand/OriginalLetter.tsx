"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Collapsible block holding the extracted German source text, rendered in mono
 * for the paperwork feel. Opens with the fog-to-clear motif.
 */
export function OriginalLetter({
  text,
  label = "See the original German",
}: {
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-start"
      >
        <FileText size={17} strokeWidth={1.75} className="text-ink-2" aria-hidden />
        <span className="text-[0.875rem] font-medium text-ink">{label}</span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          aria-hidden
          className={cn(
            "ms-auto text-ink-2 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <motion.pre
              initial={reduce ? { opacity: 0 } : { filter: "blur(6px)", opacity: 0.2 }}
              animate={{ filter: "blur(0px)", opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="whitespace-pre-wrap border-t border-line px-4 py-4 font-mono text-[0.78rem] leading-relaxed text-ink-2"
            >
              {text}
            </motion.pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
