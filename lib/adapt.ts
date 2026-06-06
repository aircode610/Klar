import {
  Banknote,
  Briefcase,
  Building2,
  FileText,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Plane,
  Radio,
  ReceiptText,
  Scale,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type {
  ActionItem,
  DeadlineView,
  DocumentCategory,
  Letter,
  Severity,
  Urgency,
} from "@/types";

const DAY = 86_400_000;

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
}

export function urgencyFromDays(days: number | null): Urgency {
  if (days === null) return "info";
  if (days < 0) return "overdue";
  if (days <= 3) return "urgent";
  if (days <= 14) return "soon";
  return "normal";
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

/** Turns a raw deadline date into a display-ready DeadlineView. */
export function deadlineView(date: string | null): DeadlineView {
  const days = daysUntil(date);
  const urgency = urgencyFromDays(days);
  let label: string;
  if (!date) label = "No deadline";
  else if (days !== null && days < 0)
    label = `Was due ${Math.abs(days)}d ago`;
  else if (days === 0) label = "Due today";
  else label = `Due ${dateLabel(date)}`;
  return { date, label, urgency, daysRemaining: days };
}

/** The single most pressing deadline across a letter's actions. */
export function letterDeadline(actions: ActionItem[]): DeadlineView {
  const dated = actions.filter((a) => a.deadline);
  if (dated.length === 0) return deadlineView(null);
  const soonest = dated.reduce((a, b) =>
    new Date(a.deadline!) <= new Date(b.deadline!) ? a : b,
  );
  return deadlineView(soonest.deadline);
}

/** All actions accounted for (done or consciously ignored). */
export function isLetterHandled(letter: Letter): boolean {
  if (letter.actions.length === 0) return false;
  return letter.actions.every(
    (a) => a.status === "done" || a.status === "ignored",
  );
}

// --- Severity -------------------------------------------------------------

export const SEVERITY_META: Record<
  Severity,
  { label: string; urgency: Urgency }
> = {
  critical: { label: "Critical", urgency: "overdue" },
  high: { label: "High", urgency: "urgent" },
  medium: { label: "Medium", urgency: "soon" },
  low: { label: "Low", urgency: "normal" },
};

// --- Category -------------------------------------------------------------

export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  health_insurance: "Health insurance",
  other_insurance: "Insurance",
  banking: "Banking",
  tax: "Tax",
  immigration: "Immigration",
  education: "Education",
  housing: "Housing",
  utilities: "Utilities",
  employment: "Employment",
  government_benefits: "Benefits",
  pension: "Pension",
  broadcast_fee: "Broadcast fee",
  civic: "Civic",
  legal_debt: "Legal / debt",
  other: "Other",
};

const CATEGORY_ICON: Record<DocumentCategory, LucideIcon> = {
  health_insurance: HeartPulse,
  other_insurance: ShieldCheck,
  banking: Banknote,
  tax: Landmark,
  immigration: Plane,
  education: GraduationCap,
  housing: Home,
  utilities: Zap,
  employment: Briefcase,
  government_benefits: Building2,
  pension: ReceiptText,
  broadcast_fee: Radio,
  civic: FileText,
  legal_debt: Scale,
  other: FileText,
};

export function categoryIcon(category: DocumentCategory): LucideIcon {
  return CATEGORY_ICON[category] ?? FileText;
}
