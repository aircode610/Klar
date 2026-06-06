"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { AlertTriangle, Check } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/api";
import type { SseEventType } from "@/types";
import { CATEGORY_LABEL, categoryIcon, riskMeta } from "@/lib/adapt";
import { URGENCY } from "@/lib/urgency";

const PHASE: Partial<Record<SseEventType, string>> = {
  ocr_result: "Reading the text",
  classification: "Identifying the letter",
  risk_score: "Assessing urgency",
  deadline: "Finding the deadline",
  consequence: "Working out what's at stake",
  explanation: "Putting it in plain words",
  response_draft: "Drafting your reply",
  checklist: "Almost there",
  citations: "Almost there",
};

interface Classification {
  type?: string;
  agency?: string;
  category?: string;
}

export default function ProcessingPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const started = useRef(false);
  const ocrRef = useRef("");

  const [phase, setPhase] = useState("Uploading your letter");
  const [error, setError] = useState<string | null>(null);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [risk, setRisk] = useState<{ score: number; label: string } | null>(null);
  const [explanation, setExplanation] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const controller = new AbortController();

    const { pendingUpload, setPendingUpload, setOcrText } = useAppStore.getState();
    if (!pendingUpload) {
      router.replace("/scan");
      return;
    }

    (async () => {
      let letterId = "";
      try {
        const { letter_id } = await api.uploadLetter(pendingUpload);
        letterId = letter_id;
        setPendingUpload(null);

        await api.processLetter(
          letter_id,
          (type, data) => {
            const d = data as Record<string, unknown>;
            if (PHASE[type]) setPhase(PHASE[type]!);
            switch (type) {
              case "ocr_result":
                ocrRef.current = String(d.text ?? "");
                break;
              case "classification":
                setClassification(d as Classification);
                break;
              case "risk_score":
                setRisk({ score: Number(d.score) || 0, label: String(d.label ?? "") });
                break;
              case "explanation":
                setExplanation((p) => p + String(d.chunk ?? ""));
                break;
              case "done":
                setDone(true);
                break;
              case "error":
                setError(String(d.message ?? "I couldn't read that one."));
                break;
            }
          },
          controller.signal,
        );

        if (ocrRef.current && letterId) setOcrText(letterId, ocrRef.current);
        // brief beat on the "Klar." moment, then open the letter
        setTimeout(() => router.replace(`/letters/${letterId}`), 700);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      }
    })();

    return () => controller.abort();
  }, [router]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-soon/40 bg-soon/10 text-soon">
            <AlertTriangle size={26} strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="text-[1.3rem] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            I couldn&apos;t read that one
          </h1>
          <p className="mt-2 max-w-xs text-[0.9rem] text-ink-2">{error}</p>
          <Link href="/scan" className="mt-6">
            <Button>Try again</Button>
          </Link>
        </div>
      </div>
    );
  }

  const Icon = classification?.category
    ? categoryIcon(classification.category as never)
    : null;
  const rm = risk ? riskMeta(risk.score) : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10" style={{ paddingTop: "max(env(safe-area-inset-top), 2rem)" }}>
      <Wordmark size="sm" />

      <div className="mt-8 flex items-center gap-2.5">
        {done ? (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex size-6 items-center justify-center rounded-full bg-done text-white"
          >
            <Check size={15} strokeWidth={3} />
          </motion.span>
        ) : (
          !reduce && (
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-ink"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </span>
          )
        )}
        <AnimatePresence mode="wait">
          <motion.span
            key={done ? "done" : phase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[0.95rem] font-medium text-ink"
          >
            {done ? "Klar. Here's what it means." : phase + "…"}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* classification + risk chips as they arrive */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {classification && (
          <>
            {Icon && (
              <span className="flex size-9 items-center justify-center rounded-(--radius-md) border border-line bg-surface-2 text-ink">
                <Icon size={18} strokeWidth={1.75} aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-mono text-[0.68rem] uppercase tracking-wide text-ink-2">
                {classification.agency}
              </p>
              <p className="truncate text-[0.95rem] font-semibold text-ink">{classification.type}</p>
            </div>
            {classification.category && (
              <Chip className="ms-1">{CATEGORY_LABEL[classification.category as never]}</Chip>
            )}
          </>
        )}
        {rm && (
          <span
            className="ms-auto rounded-full px-2.5 py-1 font-mono text-[0.7rem] font-bold"
            style={{ color: URGENCY[rm.urgency].color, backgroundColor: URGENCY[rm.urgency].soft }}
          >
            Risk {risk!.score} · {rm.label}
          </span>
        )}
      </div>

      {/* streaming explanation — the fog-to-clear payoff, live */}
      {explanation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-grain relative mt-5 flex-1 overflow-y-auto rounded-(--radius-lg) border border-line bg-surface p-5"
        >
          <p className="whitespace-pre-wrap text-[1rem] leading-relaxed text-ink">
            {explanation}
            {!done && <span className="ms-0.5 inline-block h-4 w-[2px] animate-pulse bg-ink align-middle" />}
          </p>
        </motion.div>
      )}

      {!explanation && (
        <div className="mt-8 space-y-2.5">
          {[88, 72, 95, 60].map((w, i) => (
            <motion.div
              key={i}
              className="h-2.5 rounded-full bg-ink/10"
              style={{ width: `${w}%` }}
              animate={reduce ? {} : { opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
