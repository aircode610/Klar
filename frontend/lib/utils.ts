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
