"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ReactNode, useState } from "react";
import { ChevronDown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Card with a header, an always-visible preview line, and content that
 * collapses behind a "Read more" / "Show less" toggle.
 *
 * The preview is a single-line clamp of `preview` (defaults to a truncated
 * slice of the first paragraph of `body`). The expanded content can either
 * be a plain string (rendered as a paragraph) or arbitrary children — pass
 * `children` for richer layouts (e.g. legal citations list).
 *
 * Why this exists: the detail page now surfaces five long-form fields from
 * the AI pipeline (explanation, consequence, risk reason, full draft,
 * checklist). Rendering all of them inline would bury the actionable parts
 * of the page. Gating them behind previews lets the user scan, then drill in.
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
  /** One-line teaser shown above the expand toggle. Defaults to first ~140 chars of `body`. */
  preview?: string;
  /** Plain-text body — rendered as a styled paragraph when expanded. */
  body?: string;
  /** Optional richer expanded content (overrides `body` rendering). */
  children?: ReactNode;
  expandLabel?: string;
  collapseLabel?: string;
  defaultOpen?: boolean;
  /** Visual tone — colors the left rail when set. */
  tone?: "default" | "warning" | "critical" | "info";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();

  const effectivePreview =
    preview ?? (body ? truncate(body, 140) : "");
  const hasExpandable = Boolean(children) || Boolean(body && body.length > effectivePreview.length);
  const rail = TONE_RAIL[tone];

  return (
    <div className="overflow-hidden rounded-(--radius-lg) border border-line bg-surface">
      {rail && <div className="h-0.5 w-full" style={{ backgroundColor: rail }} />}
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          {Icon && (
            <Icon
              size={17}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0 text-ink-2"
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.08em] text-ink-2">
              {title}
            </h3>
            {effectivePreview && (
              <p
                className={cn(
                  "mt-1 text-[0.92rem] leading-snug text-ink",
                  !open && "line-clamp-2",
                )}
              >
                {effectivePreview}
              </p>
            )}
          </div>
        </div>

        {hasExpandable && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-2.5 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-ink-2 hover:text-ink"
          >
            {open ? collapseLabel : expandLabel}
            <ChevronDown
              size={14}
              strokeWidth={2}
              aria-hidden
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
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
            <div className="border-t border-line px-4 py-4">
              {children ? (
                children
              ) : body ? (
                <p className="whitespace-pre-wrap text-[0.92rem] leading-relaxed text-ink">
                  {body}
                </p>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function truncate(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  if (flat.length <= n) return flat;
  // Cut on a word boundary near `n` to avoid awkward mid-word ellipses.
  const cut = flat.lastIndexOf(" ", n);
  return flat.slice(0, cut > n * 0.6 ? cut : n) + "…";
}

const TONE_RAIL: Record<"default" | "warning" | "critical" | "info", string | null> = {
  default: null,
  warning: "var(--soon)",
  critical: "var(--overdue)",
  info: "var(--brand)",
};
