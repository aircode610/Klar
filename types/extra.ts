/**
 * Prototype-only types for the differentiator features (profile vault, per-letter
 * chat, calendar appointments, process timeline). These are NOT part of the
 * backend contract in types/index.ts — they exist so the frontend prototype can
 * demonstrate the experience with example data. Promote to the contract later.
 */
import type { Urgency } from "./index";

export interface ProfileField {
  id: string;
  label: string;
  value: string;
  /** mono fields render as reference-style data (IBAN, tax ID, …) */
  mono?: boolean;
  /** sensitive values are masked until revealed */
  sensitive?: boolean;
  group: "identity" | "address" | "finance" | "status";
}

export interface ChatMessage {
  id: string;
  role: "user" | "klar";
  text: string;
}

export type CalendarEventKind = "deadline" | "appointment" | "reminder";

export interface CalendarEvent {
  id: string;
  letterId: string | null;
  title: string;
  /** ISO datetime */
  date: string;
  kind: CalendarEventKind;
  urgency: Urgency;
  /** minutes; appointments have a duration, deadlines are points in time */
  durationMins?: number;
  location?: string;
}

export interface ProcessStep {
  id: string;
  title: string;
  detail: string;
  state: "done" | "current" | "upcoming";
  /** relative hint, e.g. "in ~2 weeks" */
  whenHint?: string;
}
