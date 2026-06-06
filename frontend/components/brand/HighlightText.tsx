"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Wraps text with the signature electric-lime highlighter sweep — a hand-marked
 * bar that scales in from the inline start, behind the words. Marks what matters.
 */
export function HighlightText({
  children,
  className,
  delay = 0.15,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <span className={cn("relative inline", className)}>
      <motion.span
        aria-hidden
        className="absolute inset-x-[-0.1em] bottom-[0.04em] -z-0 h-[0.62em] origin-left rounded-[2px] bg-brand"
        initial={reduce ? { opacity: 0 } : { scaleX: 0 }}
        whileInView={reduce ? { opacity: 0.9 } : { scaleX: 1 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.32, ease: "easeOut", delay }}
      />
      <span className="relative z-10 text-ink">{children}</span>
    </span>
  );
}
