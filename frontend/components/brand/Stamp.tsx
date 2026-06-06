"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type Tone = "ink" | "done" | "brand";

const TONE: Record<Tone, string> = {
  ink: "var(--ink)",
  done: "var(--done)",
  brand: "var(--brand)",
};

/**
 * The KLAR rubber stamp — the logo and the "thunk" payoff when a letter is
 * handled or an output unlocks. Slightly rotated, ink-distressed border.
 */
export function Stamp({
  label = "KLAR",
  tone = "done",
  size = "md",
  animate = true,
  className,
}: {
  label?: string;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const color = TONE[tone];
  const sizes = {
    sm: "px-2.5 py-1 text-[0.7rem] tracking-[0.18em]",
    md: "px-4 py-1.5 text-sm tracking-[0.22em]",
    lg: "px-6 py-2.5 text-lg tracking-[0.24em]",
  };

  const thunk =
    animate && !reduce
      ? {
          initial: { scale: 1.25, rotate: -9, opacity: 0 },
          animate: { scale: 1, rotate: -5, opacity: 0.92 },
          transition: { type: "spring" as const, stiffness: 700, damping: 18, mass: 0.6 },
        }
      : {
          initial: { opacity: 0 },
          animate: { opacity: 0.92, rotate: -5 },
          transition: { duration: 0.2 },
        };

  return (
    <motion.span
      {...thunk}
      className={cn(
        "relative inline-flex select-none items-center justify-center rounded-[6px] border-[2.5px] font-bold uppercase",
        sizes[size],
        className,
      )}
      style={{
        color,
        borderColor: color,
        fontFamily: "var(--font-mono)",
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      {label}
    </motion.span>
  );
}
