/**
 * Frontend-only example data for features the backend does not (yet) provide:
 * the profile vault and the calendar's extra appointments. The per-letter chat
 * is grounded in the real /rag/search endpoint; QUICK_QUESTIONS just seed it.
 * See types/extra.ts.
 */
import type { CalendarEvent, ProfileField } from "@/types/extra";

const day = 86_400_000;
function at(daysFromNow: number, hour = 9, minute = 0): string {
  const d = new Date(Date.now() + daysFromNow * day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** The profile vault — stored once, used to pre-fill forms (prototype). */
export const PROFILE_FIELDS: ProfileField[] = [
  { id: "name", label: "Full name", value: "Danial Eyvazi", group: "identity" },
  { id: "dob", label: "Date of birth", value: "14 March 1999", group: "identity" },
  { id: "nationality", label: "Nationality", value: "Iranian", group: "identity" },
  {
    id: "address",
    label: "Registered address",
    value: "Torstraße 140, 10119 Berlin",
    group: "address",
  },
  { id: "city", label: "Anmeldung city", value: "Berlin-Mitte", group: "address" },
  {
    id: "taxid",
    label: "Tax ID (Steuer-ID)",
    value: "12 345 678 901",
    mono: true,
    group: "finance",
  },
  {
    id: "iban",
    label: "IBAN",
    value: "DE89 3704 0044 0532 0130 00",
    mono: true,
    sensitive: true,
    group: "finance",
  },
  {
    id: "insurance",
    label: "Health insurance",
    value: "Techniker Krankenkasse",
    group: "finance",
  },
  {
    id: "permit",
    label: "Residence permit",
    value: "§ 16b — Student, exp. 2026",
    group: "status",
  },
  {
    id: "bafoeg",
    label: "BAföG status",
    value: "Receiving — eligible for fee exemptions",
    group: "status",
  },
];

/** Quick questions offered under the chat box, by document category. */
export const QUICK_QUESTIONS: Record<string, string[]> = {
  default: [
    "What happens if I do nothing?",
    "Can I get more time?",
    "Which law applies here?",
  ],
  immigration: [
    "What documents exactly?",
    "What if I miss the appointment?",
    "Does my permit stay valid?",
  ],
  tax: ["What is an Einspruch?", "Can I pay in instalments?", "What's the deadline?"],
  broadcast_fee: ["Can I be exempted?", "I'm on BAföG — what now?", "How do I object?"],
  legal_debt: ["Can I still object?", "What if I ignore it?", "How does it grow?"],
};

/**
 * Extra calendar appointments (not deadlines) merged into the calendar so the
 * day timeline has timed events alongside date-only obligation deadlines.
 */
export const CALENDAR_APPOINTMENTS: CalendarEvent[] = [
  {
    id: "evt_lea",
    letterId: "ltr_auslander",
    title: "Ausländerbehörde — permit extension",
    date: at(9, 10, 30),
    kind: "appointment",
    urgency: "soon",
    durationMins: 45,
    location: "LEA Berlin, Friedrich-Krause-Ufer 24",
  },
  {
    id: "evt_buergeramt",
    letterId: null,
    title: "Bürgeramt — ID card pickup",
    date: at(2, 14, 0),
    kind: "appointment",
    urgency: "normal",
    durationMins: 20,
    location: "Bürgeramt Mitte",
  },
  {
    id: "evt_bank",
    letterId: null,
    title: "Bank appointment — Sperrkonto",
    date: at(16, 11, 0),
    kind: "appointment",
    urgency: "info",
    durationMins: 30,
    location: "Deutsche Bank, Alexanderplatz",
  },
];
