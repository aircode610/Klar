"use client";

import { motion } from "motion/react";
import { Check, Download, Lock, Share2, Sparkles, Wand2 } from "lucide-react";
import type { Letter } from "@/types";
import { Button } from "@/components/ui/Button";
import { Stamp } from "@/components/brand/Stamp";
import { formatMoney } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";

/**
 * The done-for-you output. Locked teaser → unlock → the KLAR stamp thunks in and
 * the full document appears, pre-filled from the user's profile.
 */
export function OutputBlock({
  letter,
  busy,
  onUnlock,
  onMarkSent,
}: {
  letter: Letter;
  busy: boolean;
  onUnlock: () => void;
  onMarkSent: () => void;
}) {
  const { output } = letter;
  if (output.type === "none") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-line bg-surface/60 p-4 text-center text-[0.875rem] text-ink-2">
        Nothing to send — this one is just for your records.
      </div>
    );
  }

  const unlocked = output.available && !output.locked && output.bodyText;
  const verb = output.type === "filled_form" ? "Fill this form for me" : "Generate my reply";

  if (unlocked) {
    return (
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Wand2 size={16} strokeWidth={2} className="text-done" aria-hidden />
          <span className="text-[0.9rem] font-semibold text-ink">Your document is ready</span>
          <Stamp label="KLAR" tone="done" size="sm" className="ms-auto" />
        </div>

        <div className="flex items-center gap-1.5 bg-brand/10 px-4 py-2 text-[0.75rem] text-ink-2">
          <Sparkles size={13} strokeWidth={2} className="text-ink" aria-hidden />
          Filled with your details from <span className="font-semibold text-ink">Profile</span>
        </div>

        <pre className="card-grain relative max-h-80 overflow-y-auto whitespace-pre-wrap px-4 py-4 font-mono text-[0.78rem] leading-relaxed text-ink">
          {output.bodyText}
        </pre>

        <div className="flex flex-wrap gap-2 border-t border-line p-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.success("Download started (mock).")}
          >
            <Download size={15} strokeWidth={2} aria-hidden /> Download PDF
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toast.info("Share sheet (mock).")}
          >
            <Share2 size={15} strokeWidth={2} aria-hidden /> Share
          </Button>
          {!letter.handled && (
            <Button size="sm" className="ms-auto" onClick={onMarkSent}>
              <Check size={15} strokeWidth={2.5} aria-hidden /> Mark as sent
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Locked teaser
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Lock size={15} strokeWidth={2} className="text-ink-2" aria-hidden />
        <span className="text-[0.9rem] font-semibold text-ink">{verb}</span>
        {output.price && (
          <span className="ms-auto rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[0.72rem] font-bold text-ink">
            {formatMoney(output.price)}
          </span>
        )}
      </div>

      <div className="relative">
        <pre className="max-h-40 overflow-hidden whitespace-pre-wrap px-4 py-4 font-mono text-[0.78rem] leading-relaxed text-ink-2 [mask-image:linear-gradient(to_bottom,black,transparent)]">
          {output.previewText}
        </pre>
        <motion.div
          className="pointer-events-none absolute inset-0 backdrop-blur-[3px]"
          initial={{ opacity: 0.9 }}
        />
      </div>

      <div className="border-t border-line p-3">
        <Button fullWidth size="lg" onClick={onUnlock} disabled={busy}>
          <Sparkles size={17} strokeWidth={2} aria-hidden /> {verb}
        </Button>
        <p className="mt-2 text-center text-[0.72rem] text-ink-2">
          Pre-filled from your profile · ready to send in one tap
        </p>
      </div>
    </div>
  );
}
