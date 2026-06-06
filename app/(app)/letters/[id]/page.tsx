"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellRing,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { useLetter } from "@/lib/hooks";
import * as api from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { getDictionary } from "@/lib/i18n";
import { Screen } from "@/components/ui/Screen";
import { Stamp } from "@/components/brand/Stamp";
import { HighlightText } from "@/components/brand/HighlightText";
import { OriginalLetter } from "@/components/brand/OriginalLetter";
import { DeadlineChip } from "@/components/ui/DeadlineChip";
import { toast } from "@/components/ui/Toast";
import { LetterChat } from "@/components/screens/detail/LetterChat";
import { CostMeter } from "@/components/screens/detail/CostMeter";
import { ProcessTimeline } from "@/components/screens/detail/ProcessTimeline";
import { OutputBlock } from "@/components/screens/detail/OutputBlock";
import { Paywall } from "@/components/screens/Paywall";
import { letterIcon } from "@/lib/letter-visuals";

export default function LetterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: letter, loading, error, reload } = useLetter(id);
  const lang = useAppStore((s) => s.lang);
  const d = getDictionary(lang);

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reminder, setReminder] = useState(false);

  if (loading) return <Screen><DetailSkeleton /></Screen>;
  if (error || !letter)
    return (
      <Screen>
        <BackLink />
        <p className="mt-10 text-center text-ink-2">{d.errors.generic}</p>
      </Screen>
    );

  const Icon = letterIcon(letter);
  const primary = letter.recommendedActions.find((a) => a.primary);
  const lowConfidence = letter.confidence !== null && letter.confidence < 0.9;

  const onUnlocked = async () => {
    setBusy(true);
    try {
      await api.generateOutput(letter.id);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const markSent = async () => {
    await api.patchDocument(letter.id, { handled: true });
    toast.success(d.detail.handled);
    reload();
  };

  const toggleReminder = async () => {
    const next = !reminder;
    setReminder(next);
    await api.setReminder(letter.id, next).catch(() => {});
    toast.success(next ? "Reminder set." : "Reminder removed.");
  };

  const remove = async () => {
    await api.deleteDocument(letter.id);
    toast.info("Letter deleted.");
    router.push("/letters");
  };

  return (
    <Screen width="wide">
      <div className="flex items-center justify-between pt-4">
        <BackLink />
        <button
          onClick={remove}
          aria-label="Delete letter"
          className="rounded-full p-2 text-ink-2 hover:bg-ink/[0.06] hover:text-overdue"
        >
          <Trash2 size={18} strokeWidth={1.75} />
        </button>
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="mt-2 flex items-start gap-3"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface-2 text-ink">
          <Icon size={22} strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.7rem] uppercase tracking-wide text-ink-2">
            {letter.sender}
          </p>
          <h1 className="text-[1.15rem] font-semibold text-ink">{letter.documentType}</h1>
          {letter.referenceNumber && (
            <p className="mt-0.5 font-mono text-[0.72rem] text-ink-2/80">
              Ref · {letter.referenceNumber}
            </p>
          )}
        </div>
        {letter.handled && <Stamp label="KLAR" tone="done" />}
      </motion.header>

      {lowConfidence && (
        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-soon/40 bg-soon/10 px-3 py-2 text-[0.8rem] text-ink-2">
          <AlertTriangle size={15} strokeWidth={2} className="text-soon" aria-hidden />
          {d.detail.confidenceLow}
        </div>
      )}

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
            {letter.summary}
          </motion.p>

          {/* What you need to do */}
          <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
            <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
              {d.detail.whatYouNeedToDo}
            </span>
            <p className="mt-2 text-[1.05rem] leading-relaxed text-ink">
              <HighlightText>{primary?.text ?? letter.whatItWants}</HighlightText>
            </p>
            {letter.recommendedActions.length > 1 && (
              <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                {letter.recommendedActions
                  .filter((a) => !a.primary)
                  .map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-[0.875rem] text-ink-2">
                      <ChevronRight size={15} className="text-ink-2 rtl:rotate-180" aria-hidden />
                      {a.text}
                    </li>
                  ))}
              </ul>
            )}
          </section>

          {/* Deadline + remind me */}
          {letter.deadline && (
            <section className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-4">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
                  {d.detail.deadline}
                </span>
                <p className="mt-1 truncate text-[1rem] font-semibold text-ink">
                  {letter.deadline.label}
                </p>
              </div>
              <DeadlineChip deadline={letter.deadline} />
              <button
                onClick={toggleReminder}
                aria-pressed={reminder}
                className={`flex size-10 items-center justify-center rounded-[var(--radius-md)] border transition-colors ${
                  reminder
                    ? "border-ink bg-ink text-bg"
                    : "border-line bg-surface-2 text-ink-2 hover:text-ink"
                }`}
                title={d.detail.remindMe}
              >
                {reminder ? <BellRing size={18} strokeWidth={1.75} /> : <Bell size={18} strokeWidth={1.75} />}
              </button>
            </section>
          )}

          {/* If you ignore this */}
          <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
            <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
              {d.detail.ifYouIgnore}
            </span>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
              {letter.consequence}
            </p>
          </section>

          {/* Original German */}
          {letter.originalText && (
            <OriginalLetter text={letter.originalText} label={d.detail.seeOriginal} />
          )}

          {/* The output */}
          <OutputBlock
            letter={letter}
            busy={busy}
            onUnlock={() => setPaywallOpen(true)}
            onMarkSent={markSent}
          />
        </div>

        {/* Aside: differentiators */}
        <aside className="mt-5 space-y-5 lg:mt-0">
          <CostMeter letterId={letter.id} />
          <ProcessTimeline letterId={letter.id} />
          <LetterChat letterId={letter.id} />
        </aside>
      </div>

      <Paywall
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        letter={letter}
        onUnlocked={onUnlocked}
      />
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
      <div className="h-14 w-full animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
      <div className="h-24 w-full animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
      <div className="h-32 w-full animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
    </div>
  );
}
