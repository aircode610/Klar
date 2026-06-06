"use client";

import { create } from "zustand";
import { AnimatePresence, motion } from "motion/react";
import { Check, Info, TriangleAlert } from "lucide-react";

type ToastKind = "success" | "info" | "error";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let counter = 1;

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = counter++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      3200,
    );
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative API: toast.success("Saved"), toast.error("…"). */
export const toast = {
  success: (m: string) => useToastStore.getState().push("success", m),
  info: (m: string) => useToastStore.getState().push("info", m),
  error: (m: string) => useToastStore.getState().push("error", m),
};

const ICONS = { success: Check, info: Info, error: TriangleAlert };
const COLORS = {
  success: "var(--done)",
  info: "var(--info)",
  error: "var(--overdue)",
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-2.5 shadow-[var(--shadow-float)]"
            >
              <Icon size={18} strokeWidth={2} style={{ color: COLORS[t.kind] }} aria-hidden />
              <span className="text-[0.875rem] text-ink">{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
