"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ChevronDown,
  Pause,
  Scale,
  ShieldQuestion,
  Square,
  SquareCheck,
  TriangleAlert,
  UserCheck,
  Volume2,
} from "lucide-react";
import { useLetter } from "@/lib/hooks";
import * as api from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { getDictionary } from "@/lib/i18n";
import { Screen } from "@/components/ui/Screen";
import { Stamp } from "@/components/brand/Stamp";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { OriginalLetter } from "@/components/brand/OriginalLetter";
import { LetterChat } from "@/components/screens/detail/LetterChat";
import { ObligationCard } from "@/components/screens/detail/ObligationCard";
import { ReplyDraft } from "@/components/screens/detail/ReplyDraft";
import { toast } from "@/components/ui/Toast";
import { CATEGORY_LABEL, categoryIcon, isLetterHandled, riskMeta } from "@/lib/adapt";
import { URGENCY } from "@/lib/urgency";
import { speak, speechSupported, stopSpeaking } from "@/lib/speech";
import { cn } from "@/lib/utils";
import type { Citation } from "@/types";

export default function LetterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: letter, loading, error, reload } = useLetter(id);
  const lang = useAppStore((s) => s.lang);
  const ocr = useAppStore((s) => s.ocrText[id]);
  const d = getDictionary(lang);
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [speaking, setSpeaking] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [humanOpen, setHumanOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => () => stopSpeaking(), []);

  if (loading) return <Screen><DetailSkeleton /></Screen>;
  if (error || !letter)
    return (
      <Screen>
        <div className="pt-4"><BackLink /></div>
        <p className="mt-10 text-center text-ink-2">{error ?? "That letter could not be found."}</p>
      </Screen>
    );

  const Icon = categoryIcon(letter.category);
  const actions = letter.actions.map((a) =>
    optimistic[a.id] ? { ...a, status: optimistic[a.id] as typeof a.status } : a,
  );
  const handled = isLetterHandled({ actions });
  const primaryId = letter.actions.find((a) => a.deadline)?.id ?? letter.actions[0]?.id;
  const rm = riskMeta(letter.risk_score);
  const hasWarnings = letter.extraction_warnings.length > 0;

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

  const editAction = async (actionId: string, patch: { title?: string; deadline?: string }) => {
    try {
      await api.updateAction(actionId, patch);
      toast.success("Updated — thanks, that helps Klar learn.");
      reload();
    } catch {
      toast.error("Couldn't save your change.");
    }
  };

  const toggleListen = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const ok = speak(letter.summary, lang, () => setSpeaking(false));
    if (ok) setSpeaking(true);
  };

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
          <p className="font-mono text-[0.7rem] uppercase tracking-wide text-ink-2">{letter.institution}</p>
          <h1 className="text-[1.15rem] font-semibold text-ink">{letter.document_type || letter.letter_type}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Chip>{CATEGORY_LABEL[letter.category]}</Chip>
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[0.62rem] font-bold"
              style={{ color: URGENCY[rm.urgency].color, backgroundColor: URGENCY[rm.urgency].soft }}
            >
              Risk {letter.risk_score} · {rm.label}
            </span>
          </div>
        </div>
        {handled && <Stamp label="KLAR" tone="done" />}
      </motion.header>

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        {/* Main column */}
        <div className="space-y-5">
          {/* Clarity summary + listen */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.06 }}
              className="text-[1.5rem] font-bold leading-snug text-ink"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
            >
              {letter.summary || "Reading this letter…"}
            </motion.p>
            {mounted && speechSupported() && letter.summary && (
              <button
                onClick={toggleListen}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[0.78rem] text-ink-2 hover:text-ink"
              >
                {speaking ? <Pause size={14} /> : <Volume2 size={14} />}
                {speaking ? "Stop" : "Listen"}
              </button>
            )}
          </div>

          {/* Warnings + human check */}
          {hasWarnings && (
            <div className="rounded-(--radius-md) border border-soon/40 bg-soon/10 px-3 py-2.5">
              <div className="flex items-start gap-2 text-[0.8rem] text-ink-2">
                <TriangleAlert size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-soon" aria-hidden />
                <span>{letter.extraction_warnings.join(" ")}</span>
              </div>
              <button
                onClick={() => setHumanOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-ink underline-offset-4 hover:underline"
              >
                <UserCheck size={14} strokeWidth={2} /> Get a human to check
              </button>
            </div>
          )}

          {/* Explanation */}
          {letter.explanation && (
            <section className="rounded-(--radius-lg) border border-line bg-surface p-4">
              <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
                What this means
              </span>
              <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink">
                {letter.explanation}
              </p>
            </section>
          )}

          {/* Consequence */}
          {letter.consequence && (
            <section className="rounded-(--radius-lg) border border-line bg-surface p-4">
              <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
                {d.detail.ifYouIgnore}
              </span>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{letter.consequence}</p>
            </section>
          )}

          {/* Obligations */}
          {actions.length > 0 && (
            <div>
              <h2 className="mb-2.5 font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
                {d.detail.whatYouNeedToDo}
              </h2>
              <div className="space-y-3">
                {actions.map((a) => (
                  <ObligationCard
                    key={a.id}
                    action={a}
                    primary={a.id === primaryId}
                    institution={letter.institution}
                    onMarkDone={markDone}
                    onEdit={editAction}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Checklist */}
          {letter.checklist.length > 0 && <Checklist items={letter.checklist} />}

          {/* Reply */}
          {letter.response_draft && <ReplyDraft body={letter.response_draft} />}

          {/* Citations */}
          {letter.citations.length > 0 && <Citations items={letter.citations} />}

          {/* Original German */}
          {ocr && <OriginalLetter text={ocr} label={d.detail.seeOriginal} />}
        </div>

        {/* Aside: RAG chat */}
        <aside className="mt-5 lg:mt-0">
          <LetterChat institution={letter.institution} category={letter.category} />
        </aside>
      </div>

      <BottomSheet open={humanOpen} onClose={() => setHumanOpen(false)} title="Get a human to check">
        <p className="text-[0.9rem] leading-relaxed text-ink-2">
          When Klar isn&apos;t fully sure, a trained reviewer can verify the reading and
          the deadline — usually within a few hours.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-(--radius-md) bg-surface-2 px-3 py-2 text-[0.8rem] text-ink-2">
          <ShieldQuestion size={16} className="text-ink" aria-hidden /> Your letter stays private and in the EU.
        </div>
        <Button
          fullWidth
          size="lg"
          className="mt-4"
          onClick={() => {
            setHumanOpen(false);
            toast.success("Sent for human review — we'll let you know.");
          }}
        >
          Request a review
        </Button>
      </BottomSheet>
    </Screen>
  );
}

function Checklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  return (
    <section className="rounded-(--radius-lg) border border-line bg-surface p-4">
      <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
        What to gather
      </span>
      <ul className="mt-3 space-y-1.5">
        {items.map((it, i) => {
          const on = checked[i];
          return (
            <li key={i}>
              <button onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))} className="flex w-full items-start gap-2 text-start">
                {on ? (
                  <SquareCheck size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-done" aria-hidden />
                ) : (
                  <Square size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
                )}
                <span className={cn("text-[0.9rem] text-ink", on && "text-ink-2 line-through")}>{it}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Citations({ items }: { items: Citation[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-(--radius-lg) border border-line bg-surface-2">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2.5 px-4 py-3 text-start">
        <Scale size={16} strokeWidth={1.75} className="text-ink-2" aria-hidden />
        <span className="text-[0.875rem] font-medium text-ink">Legal grounding · {items.length}</span>
        <ChevronDown size={18} strokeWidth={2} aria-hidden className={cn("ms-auto text-ink-2 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <ul className="space-y-2.5 border-t border-line px-4 py-3">
              {items.map((c, i) => (
                <li key={i}>
                  <p className="font-mono text-[0.72rem] font-bold text-ink">{c.section}</p>
                  <p className="mt-0.5 text-[0.8rem] leading-relaxed text-ink-2">{c.text}</p>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/letters" className="inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-2 hover:text-ink">
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
