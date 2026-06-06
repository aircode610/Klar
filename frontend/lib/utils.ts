import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names, with later Tailwind utilities winning conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format minor-unit money (e.g. {amount: 499, currency:'EUR'}) as "€4.99". */
export function formatMoney(money: { amount: number; currency: string } | null) {
  if (!money) return "";
  const value = money.amount / 100;
  const symbol = money.currency === "EUR" ? "€" : money.currency + " ";
  return `${symbol}${value.toFixed(2)}`;
}

/**
 * Format an EUR amount given as a regular float (e.g. 142.8 → "€142,80"
 * in de-DE locale, "€142.80" in en-DE). Used for outstanding payment amounts
 * extracted from German letters.
 */
export function formatEur(amount: number, locale: string = "en-DE") {
  // Map Klar's UI lang codes to a sensible BCP-47 currency locale.
  const localeMap: Record<string, string> = {
    en: "en-DE",
    de: "de-DE",
    fa: "fa-IR",
    tr: "tr-TR",
    ar: "ar-EG",
    uk: "uk-UA",
  };
  const resolved = localeMap[locale] ?? locale ?? "en-DE";
  try {
    return new Intl.NumberFormat(resolved, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `€${amount.toFixed(2)}`;
  }
}
