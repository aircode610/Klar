"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Briefcase, Check, GraduationCap, Heart, MoreHorizontal } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Stamp } from "@/components/brand/Stamp";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";
import { LANGS, LANG_LABEL, DIR } from "@/lib/i18n";
import type { Lang } from "@/types";
import { cn } from "@/lib/utils";

const REASONS = [
  { id: "study", label: "Studying", Icon: GraduationCap },
  { id: "work", label: "Working", Icon: Briefcase },
  { id: "family", label: "Family", Icon: Heart },
  { id: "other", label: "Something else", Icon: MoreHorizontal },
];

export default function OnboardingPage() {
  const router = useRouter();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState<string | null>(null);

  const finish = () => {
    setOnboarded(true);
    router.push("/letters");
  };

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-8"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
    >
      {/* progress + skip */}
      <div className="flex items-center gap-2 py-3">
        {[0, 1].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= step ? "bg-brand" : "bg-line",
            )}
          />
        ))}
        <button onClick={finish} className="ms-2 text-[0.8rem] text-ink-2 hover:text-ink">
          Skip
        </button>
      </div>

      {step === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-1 flex-col"
        >
          <div className="relative pt-8">
            <Stamp
              label="KLAR"
              tone="ink"
              size="lg"
              animate={false}
              className="absolute -top-2 end-0 opacity-10"
            />
            <Wordmark size="lg" />
            <h1
              className="mt-5 text-[2rem] font-bold leading-tight text-ink"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
            >
              The calm friend who has survived German bureaucracy.
            </h1>
            <p className="mt-3 text-[1rem] leading-relaxed text-ink-2">
              Photograph any official letter. I&apos;ll tell you what it means, what
              to do, and by when — in your language.
            </p>
          </div>

          <div className="mt-7">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
              Choose your language
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {LANGS.map((l) => (
                <LangButton key={l} l={l} active={l === lang} onClick={() => onPickLang(l, setLang)} />
              ))}
            </div>
          </div>

          <Button fullWidth size="lg" className="mt-auto" onClick={() => setStep(1)}>
            Continue <ArrowRight size={18} className="rtl:rotate-180" aria-hidden />
          </Button>
        </motion.div>
      )}

      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-1 flex-col"
        >
          <div className="pt-10">
            <h1
              className="text-[1.75rem] font-bold leading-tight text-ink"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
            >
              What brings you to Germany?
            </h1>
            <p className="mt-2 text-[0.95rem] text-ink-2">
              Optional — it just helps me tailor the wording.
            </p>
          </div>

          <div className="mt-6 space-y-2.5">
            {REASONS.map(({ id, label, Icon }) => {
              const active = reason === id;
              return (
                <button
                  key={id}
                  onClick={() => setReason(id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[var(--radius-lg)] border p-4 text-start transition-all",
                    active
                      ? "border-ink bg-surface ring-2 ring-brand"
                      : "border-line bg-surface hover:border-ink/30",
                  )}
                >
                  <Icon size={20} strokeWidth={1.75} className="text-ink" aria-hidden />
                  <span className="font-medium text-ink">{label}</span>
                  {active && <Check size={18} strokeWidth={2.5} className="ms-auto text-done" aria-hidden />}
                </button>
              );
            })}
          </div>

          <Button fullWidth size="lg" className="mt-auto" onClick={finish}>
            Start with Klar
          </Button>
        </motion.div>
      )}
    </div>
  );
}

function onPickLang(l: Lang, setLang: (l: Lang) => void) {
  setLang(l);
}

function LangButton({ l, active, onClick }: { l: Lang; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      dir={DIR[l]}
      className={cn(
        "flex items-center justify-between rounded-[var(--radius-md)] border px-4 py-3 text-[0.95rem] font-medium transition-all",
        active ? "border-ink bg-surface ring-2 ring-brand" : "border-line bg-surface hover:border-ink/30",
      )}
    >
      <span className="text-ink">{LANG_LABEL[l]}</span>
      {active && <Check size={16} strokeWidth={2.5} className="text-done" aria-hidden />}
    </button>
  );
}
