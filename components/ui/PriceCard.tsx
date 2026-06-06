import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils";
import type { Money } from "@/types";

/** A selectable pricing option for the paywall. */
export function PriceCard({
  title,
  price,
  interval,
  features,
  badge,
  selected,
  onSelect,
}: {
  title: string;
  price: Money;
  interval?: string;
  features?: string[];
  badge?: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-[var(--radius-lg)] border p-4 text-start transition-all",
        selected
          ? "border-ink bg-surface ring-2 ring-brand"
          : "border-line bg-surface hover:border-ink/30",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">{title}</span>
        {badge && (
          <span className="rounded-full bg-brand px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-brand-ink">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className="tabular text-2xl font-bold text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {formatMoney(price)}
        </span>
        {interval && <span className="text-[0.8125rem] text-ink-2">/ {interval}</span>}
      </div>
      {features && features.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-[0.8125rem] text-ink-2">
              <Check size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-done" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}
