"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const STEPS = [
  "Reading your letter.",
  "Finding the sender and the reference number.",
  "Spotting the deadline and what they want.",
  "Putting it in plain words.",
];

/**
 * The processing animation: blurred German lines sharpening (fog-to-clear) with
 * honest, rotating status text. Earns trust where a generic spinner would not.
 */
export function ReadingLoader() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      1600,
    );
    return () => clearInterval(t);
  }, []);

  const widths = [88, 72, 95, 60, 80, 45];

  return (
    <div className="flex flex-col items-center">
      {/* Document with sharpening lines */}
      <div className="card-grain relative w-full max-w-[260px] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <div className="mb-3 h-2.5 w-20 rounded-full bg-ink/15" />
        <div className="space-y-2.5">
          {widths.map((w, i) => (
            <motion.div
              key={i}
              className="h-2 rounded-full bg-ink/12"
              style={{ width: `${w}%` }}
              initial={reduce ? { opacity: 0.4 } : { filter: "blur(3px)", opacity: 0.3 }}
              animate={
                reduce
                  ? { opacity: [0.3, 0.7, 0.3] }
                  : { filter: ["blur(3px)", "blur(0px)", "blur(3px)"], opacity: [0.3, 0.75, 0.3] }
              }
              transition={{
                duration: 2.2,
                repeat: Infinity,
                delay: i * 0.18,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        {/* lime scan line */}
        {!reduce && (
          <motion.div
            className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-brand/25 to-transparent"
            initial={{ top: "-10%" }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      <div className="mt-6 h-12 text-center">
        {STEPS.map((s, i) => (
          <motion.p
            key={s}
            className="text-[0.95rem] text-ink"
            initial={{ opacity: 0, y: 6, position: "absolute" }}
            animate={
              i === step
                ? { opacity: 1, y: 0, position: "relative" }
                : { opacity: 0, y: -6, position: "absolute" }
            }
            transition={{ duration: 0.4 }}
            style={{ left: 0, right: 0 }}
          >
            {s}
          </motion.p>
        ))}
      </div>
    </div>
  );
}
