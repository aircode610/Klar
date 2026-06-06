"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ReactNode, useState } from "react";
import { ChevronDown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Card with a tone-colored icon badge, a section header, a preview, and a
 * "Read more" toggle that reveals the full content. Used on the letter
 * detail page for AI-generated long-form fields (consequence, explanation,
 * citations, draft reply). Each card adopts a tone — `critical` for the
 * "if you ignore" callout, `warning` for risk-reason, `info` for
 * explanation, `default` for neutral content like the pre-drafted reply.
 */
export function ExpandableSection({
  icon: Icon,
  title,
  preview,
  body,
  children,
  expandLabel = "Read more",
  collapseLabel = "Show less",
  defaultOpen = false,
  tone = "default",
}: {
  icon?: LucideIcon;
  title: string;
  /** One-line teaser shown above the toggle. Defaults to first ~160 chars of `body`. */
  preview?: string;
  /** Plain-text body — rendered as a styled paragraph when expanded. */
  body?: string;
  /** Optional richer expanded content (overrides `body` rendering). */
  children?: ReactNode;
  expandLabel?: string;
  collapseLabel?: string;
  defaultOpen?: boolean;
  /** Visual tone — colors the icon badge and section accent. */
  tone?: "default" | "warning" | "critical" | "info";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();

  const effectivePreview = preview ?? (body ? truncate(body, 160) : "");
  const hasExpandable =
    Boolean(children) || Boolean(body && body.length > effectivePreview.length);
  const t = TONE[tone];

  return (
    <section className="group/section overflow-hidden rounded-(--radius-lg) border border-line bg-surface transition-colors hover:border-ink/20">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3.5">
          {Icon && (
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-md) ring-1 ring-inset"
              style={{
                backgroundColor: t.iconBg,
                color: t.iconFg,
                // @ts-expect-error — Tailwind passes through to ring-color via the var.
                "--tw-ring-color": t.iconRing,
              }}
            >
              <Icon size={17} strokeWidth={2} aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-[0.95rem] font-semibold leading-snug tracking-tight text-ink">
              {title}
            </h3>
            {effectivePreview && (
              <p
                className={cn(
                  "mt-1 text-[0.9rem] leading-relaxed text-ink-2",
                  !open && "line-clamp-2",
                )}
              >
                {effectivePreview}
              </p>
            )}
          </div>
        </div>

        {hasExpandable && (
          <div className="mt-3 flex">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="ms-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.78rem] font-semibold text-ink-2 transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              {open ? collapseLabel : expandLabel}
              <ChevronDown
                size={14}
                strokeWidth={2.25}
                aria-hidden
                className={cn("transition-transform", open && "rotate-180")}
              />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && hasExpandable && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: "easeOut" }}
          >
            <div
              className="border-t px-5 py-5 sm:px-6"
              style={{ borderColor: t.divider }}
            >
              {children ? (
                children
              ) : body ? (
                <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink">
                  {body}
                </p>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function truncate(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  if (flat.length <= n) return flat;
  const cut = flat.lastIndexOf(" ", n);
  return flat.slice(0, cut > n * 0.6 ? cut : n) + "…";
}

type Tone = {
  iconBg: string;
  iconFg: string;
  iconRing: string;
  divider: string;
};

const TONE: Record<"default" | "warning" | "critical" | "info", Tone> = {
  default: {
    iconBg: "color-mix(in srgb, var(--ink) 6%, transparent)",
    iconFg: "var(--ink)",
    iconRing: "color-mix(in srgb, var(--ink) 12%, transparent)",
    divider: "var(--line)",
  },
  warning: {
    iconBg: "color-mix(in srgb, var(--soon) 14%, transparent)",
    iconFg: "var(--soon)",
    iconRing: "color-mix(in srgb, var(--soon) 30%, transparent)",
    divider: "color-mix(in srgb, var(--soon) 25%, var(--line))",
  },
  critical: {
    iconBg: "color-mix(in srgb, var(--overdue) 12%, transparent)",
    iconFg: "var(--overdue)",
    iconRing: "color-mix(in srgb, var(--overdue) 30%, transparent)",
    divider: "color-mix(in srgb, var(--overdue) 25%, var(--line))",
  },
  info: {
    iconBg: "color-mix(in srgb, var(--brand) 14%, transparent)",
    iconFg: "var(--brand)",
    iconRing: "color-mix(in srgb, var(--brand) 30%, transparent)",
    divider: "color-mix(in srgb, var(--brand) 25%, var(--line))",
  },
};
