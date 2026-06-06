"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile-native bottom sheet for actions and the paywall. On larger screens it
 * floats as a centred dialog. Honours safe-area inset and Escape to close.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "relative w-full max-w-md border border-line bg-surface",
              "rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)]",
              "shadow-[var(--shadow-float)]",
              className,
            )}
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
          >
            <div className="flex items-center justify-between px-5 pt-4">
              <span className="mx-auto h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
            </div>
            <div className="flex items-start justify-between gap-3 px-5 pt-2">
              {title && (
                <h2
                  className="text-[1.3125rem] font-semibold text-ink"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {title}
                </h2>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className="ms-auto -me-1 rounded-full p-1.5 text-ink-2 hover:bg-ink/[0.06]"
              >
                <X size={20} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <div className="px-5 pb-5 pt-3">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
