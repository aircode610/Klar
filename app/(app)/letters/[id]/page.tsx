"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { useLetter } from "@/lib/hooks";
import * as api from "@/lib/api";
import { Screen } from "@/components/ui/Screen";
import { Stamp } from "@/components/brand/Stamp";
import { Chip } from "@/components/ui/Chip";
import { LetterChat } from "@/components/screens/detail/LetterChat";
import { ObligationCard } from "@/components/screens/detail/ObligationCard";
import { toast } from "@/components/ui/Toast";
import {
  CATEGORY_LABEL,
  categoryIcon,
  isLetterHandled,
} from "@/lib/adapt";

export default function LetterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: letter, loading, error, reload } = useLetter(id);
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  if (loading) return <Screen><DetailSkeleton /></Screen>;
  if (error || !letter)
    return (
      <Screen>
        <div className="pt-4"><BackLink /></div>
        <p className="mt-10 text-center text-ink-2">
          {error ?? "That letter could not be found."}
        </p>
      </Screen>
    );

  const Icon = categoryIcon(letter.category);
  const handled = isLetterHandled({
    ...letter,
    actions: letter.actions.map((a) =>
      optimistic[a.id] ? { ...a, status: optimistic[a.id] as typeof a.status } : a,
    ),
  });
  const primaryId = letter.actions.find((a) => a.deadline)?.id ?? letter.actions[0]?.id;

  const markDone = async (actionId: string, done: boolean) => {
    const status = done ? "done" : "open";
    setOptimistic((o) => ({ ...o, [actionId]: status }));
    try {
      await api.updateAction(actionId, { status });
      toast.success(done ? "Marked done. Klar." : "Reopened.");
      reload();
    } catch {
      setOptimistic((o) => {
        const next = { ...o };
        delete next[actionId];
        return next;
      });
      toast.error("Couldn't update that.");
    }
  };

  const actions = letter.actions.map((a) =>
    optimistic[a.id] ? { ...a, status: optimistic[a.id] as typeof a.status } : a,
  );

  return (
    <Screen width="wide">
      <div className="pt-4"><BackLink /></div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="mt-2 flex items-start gap-3"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-(--radius-md) border border-line bg-surface-2 text-ink">
          <Icon size={22} strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.7rem] uppercase tracking-wide text-ink-2">
            {letter.institution}
          </p>
          <h1 className="text-[1.15rem] font-semibold text-ink">{letter.document_type}</h1>
          <Chip className="mt-1">{CATEGORY_LABEL[letter.category]}</Chip>
        </div>
        {handled && <Stamp label="KLAR" tone="done" />}
      </motion.header>

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        {/* Main column */}
        <div className="space-y-5">
          {/* Clarity statement */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.06 }}
            className="text-[1.5rem] font-bold leading-snug text-ink"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            {letter.summary_en}
          </motion.p>

          {/* Extraction warnings */}
          {letter.extraction_warnings.length > 0 && (
            <div className="flex items-start gap-2 rounded-(--radius-md) border border-soon/40 bg-soon/10 px-3 py-2 text-[0.8rem] text-ink-2">
              <TriangleAlert size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-soon" aria-hidden />
              <span>{letter.extraction_warnings.join(" ")}</span>
            </div>
          )}

          {/* Obligations */}
          <div>
            <h2 className="mb-2.5 font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
              {actions.length > 1 ? "What you need to do" : "What you need to do"}
            </h2>
            <div className="space-y-3">
              {actions.length === 0 ? (
                <div className="rounded-(--radius-lg) border border-dashed border-line bg-surface/60 p-4 text-center text-[0.875rem] text-ink-2">
                  Nothing to do — this one is just for your records.
                </div>
              ) : (
                actions.map((a) => (
                  <ObligationCard
                    key={a.id}
                    action={a}
                    primary={a.id === primaryId}
                    onMarkDone={markDone}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Aside: RAG-grounded chat */}
        <aside className="mt-5 lg:mt-0">
          <LetterChat institution={letter.institution} category={letter.category} />
        </aside>
      </div>
    </Screen>
  );
}

function BackLink() {
  return (
    <Link
      href="/letters"
      className="inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-2 hover:text-ink"
    >
      <ArrowLeft size={17} strokeWidth={2} aria-hidden className="rtl:rotate-180" />
      Letters
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4 pt-6">
      <div className="h-6 w-24 animate-pulse rounded bg-surface-2" />
      <div className="h-14 w-full animate-pulse rounded-(--radius-lg) bg-surface-2" />
      <div className="h-24 w-full animate-pulse rounded-(--radius-lg) bg-surface-2" />
      <div className="h-32 w-full animate-pulse rounded-(--radius-lg) bg-surface-2" />
    </div>
  );
}
