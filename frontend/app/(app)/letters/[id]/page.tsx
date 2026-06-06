"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import {
  AlertOctagon,
  ArrowLeft,
  BookOpen,
  Gauge,
  Mail,
  Pause,
  Scale,
  ShieldQuestion,
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
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import { DocumentChecklist } from "@/components/screens/detail/DocumentChecklist";
import { LetterChat } from "@/components/screens/detail/LetterChat";
import { ObligationCard } from "@/components/screens/detail/ObligationCard";
import { ReplyDraft } from "@/components/screens/detail/ReplyDraft";
import { toast } from "@/components/ui/Toast";
import { CATEGORY_LABEL, categoryIcon, isLetterHandled } from "@/lib/adapt";
import { speak, speechSupported, stopSpeaking } from "@/lib/speech";
import { formatEur } from "@/lib/utils";
import { Coins } from "lucide-react";

export default function LetterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: letter, loading, error, reload } = useLetter(id);
  const lang = useAppStore((s) => s.lang);
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
  const handled = isLetterHandled({ ...letter, actions });
  const primaryId = letter.actions.find((a) => a.deadline)?.id ?? letter.actions[0]?.id;
  const replyAction = letter.actions.find((a) => a.reply_needed);
  const lowConfidence = letter.confidence != null && letter.confidence < 0.85;
  // Sum of outstanding EUR across actions that are still open (or were just
  // optimistically toggled). Backend writes amount_due_eur on at most one
  // action per letter so this is essentially "the amount" — summed for
  // robustness against future multi-payment letters.
  const totalDue = actions.reduce((acc, a) => {
    if (a.status === "done" || a.status === "ignored") return acc;
    return acc + (a.amount_due_eur ?? 0);
  }, 0);

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
    const ok = speak(letter.summary_en, lang, () => setSpeaking(false));
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
          <h1 className="text-[1.15rem] font-semibold text-ink">{letter.document_type}</h1>
          <Chip className="mt-1">{CATEGORY_LABEL[letter.category]}</Chip>
        </div>
        {handled && <Stamp label="KLAR" tone="done" />}
      </motion.header>

      {/* Prominent "amount to pay" callout — the headline outstanding number
          for this letter. Skipped when nothing is owed so the page stays
          clean for non-payment correspondence. */}
      {totalDue > 0 && !handled && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.04 }}
          className="mt-4 flex items-center gap-3 rounded-(--radius-lg) border px-4 py-3"
          style={{
            borderColor: "color-mix(in srgb, var(--overdue) 35%, var(--line))",
            backgroundColor: "color-mix(in srgb, var(--overdue) 8%, var(--surface))",
          }}
        >
          <Coins size={20} strokeWidth={1.75} className="shrink-0 text-overdue" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[0.68rem] uppercase tracking-wide text-ink-2">
              {d.home.outstanding}
            </p>
            <p
              className="tabular text-[1.5rem] font-bold leading-none text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatEur(totalDue, lang)}
            </p>
          </div>
        </motion.div>
      )}

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        {/* Main column */}
        <div className="space-y-5">
          {/* Clarity statement + listen */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.06 }}
              className="text-[1.5rem] font-bold leading-snug text-ink"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
            >
              {letter.summary_en}
            </motion.p>
            {mounted && speechSupported() && (
              <button
                onClick={toggleListen}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[0.78rem] text-ink-2 hover:text-ink"
              >
                {speaking ? <Pause size={14} /> : <Volume2 size={14} />}
                {speaking ? "Stop" : "Listen"}
              </button>
            )}
          </div>

          {/* Confidence / warnings */}
          {(lowConfidence || letter.extraction_warnings.length > 0) && (
            <div className="rounded-(--radius-md) border border-soon/40 bg-soon/10 px-3 py-2.5">
              <div className="flex items-start gap-2 text-[0.8rem] text-ink-2">
                <TriangleAlert size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-soon" aria-hidden />
                <span>
                  {lowConfidence ? d.detail.confidenceLow + " " : ""}
                  {letter.extraction_warnings.join(" ")}
                </span>
              </div>
              {lowConfidence && (
                <button
                  onClick={() => setHumanOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-ink underline-offset-4 hover:underline"
                >
                  <UserCheck size={14} strokeWidth={2} /> Get a human to check
                </button>
              )}
            </div>
          )}

          {/* Obligations */}
          <div>
            <h2 className="mb-2.5 font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
              {d.detail.whatYouNeedToDo}
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
                    institution={letter.institution}
                    onMarkDone={markDone}
                    onEdit={editAction}
                  />
                ))
              )}
            </div>
          </div>

          {/* AI-generated long-form context, all collapsed by default so
              the actionable obligations stay above the fold. */}
          {letter.consequence && (
            <ExpandableSection
              icon={AlertOctagon}
              title={d.detail.consequenceTitle}
              body={letter.consequence}
              tone="critical"
              expandLabel={d.detail.readMore}
              collapseLabel={d.detail.showLess}
            />
          )}

          {letter.risk_reason && (
            <ExpandableSection
              icon={Gauge}
              title={d.detail.whyThisRisk}
              body={letter.risk_reason}
              tone="warning"
              expandLabel={d.detail.readMore}
              collapseLabel={d.detail.showLess}
            />
          )}

          {letter.explanation && (
            <ExpandableSection
              icon={BookOpen}
              title={d.detail.fullExplanation}
              body={letter.explanation}
              tone="info"
              expandLabel={d.detail.readMore}
              collapseLabel={d.detail.showLess}
            />
          )}

          {letter.checklist && letter.checklist.length > 0 && (
            <DocumentChecklist
              title={d.detail.checklistTitle}
              items={letter.checklist}
            />
          )}

          {letter.citations && letter.citations.length > 0 && (
            <ExpandableSection
              icon={Scale}
              title={d.detail.citationsTitle}
              preview={letter.citations.map((c) => c.section).join(" · ")}
              expandLabel={d.detail.readMore}
              collapseLabel={d.detail.showLess}
            >
              <ul className="space-y-3 text-[0.92rem] text-ink">
                {letter.citations.map((c, i) => (
                  <li key={i}>
                    <div className="font-mono text-[0.78rem] font-semibold text-ink">
                      {c.section}
                    </div>
                    {c.text && (
                      <p className="mt-1 leading-relaxed text-ink-2">{c.text}</p>
                    )}
                  </li>
                ))}
              </ul>
            </ExpandableSection>
          )}

          {letter.response_draft && (
            <ExpandableSection
              icon={Mail}
              title={d.detail.draftReplyTitle}
              body={letter.response_draft}
              expandLabel={d.detail.readMore}
              collapseLabel={d.detail.showLess}
            />
          )}

          {/* Reply generator (network-call to refresh / regenerate) */}
          {replyAction && <ReplyDraft letterId={letter.id} actionId={replyAction.id} />}

          {/* Original German */}
          {letter.ocr_text && (
            <OriginalLetter text={letter.ocr_text} label={d.detail.seeOriginal} />
          )}
        </div>

        {/* Aside: RAG-grounded chat */}
        <aside className="mt-5 lg:mt-0">
          <LetterChat letterId={letter.id} institution={letter.institution} category={letter.category} />
        </aside>
      </div>

      {/* Human-check sheet */}
      <BottomSheet open={humanOpen} onClose={() => setHumanOpen(false)} title="Get a human to check">
        <p className="text-[0.9rem] leading-relaxed text-ink-2">
          When Klar isn&apos;t fully sure, a trained reviewer can verify the reading and
          the deadline — usually within a few hours. We&apos;ll notify you when it&apos;s
          confirmed.
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
