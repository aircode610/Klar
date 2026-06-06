/**
 * Prototype-only example data for the differentiator features. Imported directly
 * by screens (not served via the API contract). See types/extra.ts.
 */
import type {
  CalendarEvent,
  ChatMessage,
  ProcessStep,
  ProfileField,
} from "@/types/extra";

const day = 86_400_000;
function at(daysFromNow: number, hour = 9, minute = 0): string {
  const d = new Date(Date.now() + daysFromNow * day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Cost-of-ignoring model per letter. Powers the "this grows" meter — a Klar
 * differentiator that makes the consequence concrete and drives action.
 */
export const COST_MODEL: Record<
  string,
  { current: number; perWeek: number; ceiling: number; enforceableInDays: number }
> = {
  // amounts in EUR cents
  ltr_strafzettel: { current: 6000, perWeek: 1500, ceiling: 25000, enforceableInDays: 12 },
  ltr_rundfunk: { current: 11040, perWeek: 800, ceiling: 30000, enforceableInDays: 21 },
  ltr_finanzamt: { current: 41200, perWeek: 600, ceiling: 50000, enforceableInDays: 30 },
};

/** The profile vault — stored once, used to auto-fill replies and forms. */
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

/** Per-letter seeded chat, so "Ask a follow-up" feels alive on first open. */
export const SEED_CHAT: Record<string, ChatMessage[]> = {
  ltr_finanzamt: [
    {
      id: "c1",
      role: "klar",
      text: "Ask me anything about this tax assessment — what the numbers mean, your options, or what happens next.",
    },
  ],
  ltr_strafzettel: [
    {
      id: "c1",
      role: "klar",
      text: "This one is already overdue. Ask me how to limit the cost, or whether an objection is still worth it.",
    },
  ],
};

/** Quick questions offered as chips under the chat box, per document type. */
export const QUICK_QUESTIONS: Record<string, string[]> = {
  default: [
    "What happens if I do nothing?",
    "Can I get more time?",
    "Is this a scam or real?",
  ],
  ltr_finanzamt: [
    "Why do I owe this?",
    "What is an Einspruch?",
    "What if I can't pay now?",
  ],
  ltr_strafzettel: [
    "Can I still object?",
    "How much will it grow?",
    "What if I ignore it?",
  ],
  ltr_auslander: [
    "What documents exactly?",
    "What if I miss the appointment?",
    "Can I reschedule?",
  ],
};

/** Canned, on-brand answers used by the prototype chat. */
export function mockAnswer(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("nothing") || q.includes("ignore"))
    return "Then the amount stays due and starts to grow — first a reminder fee, then a payment order. Better to act before the date. I can draft the response for you.";
  if (q.includes("scam") || q.includes("real"))
    return "It is genuine. The sender, reference number and tone all match a real official letter. You can safely act on it.";
  if (q.includes("time") || q.includes("reschedule") || q.includes("more time"))
    return "Often yes — you can request an extension in writing before the deadline. I can prepare that request with your details already filled in.";
  if (q.includes("einspruch") || q.includes("object"))
    return "An Einspruch is a formal objection. You state that you disagree and ask them to review. It pauses the consequence while they decide. I can write it for you.";
  if (q.includes("pay"))
    return "You don't have to pay everything at once — you can ask for an instalment plan (Ratenzahlung). I can include that request in your reply.";
  if (q.includes("document"))
    return "Bring your passport, enrolment certificate, proof of health insurance and the blocked-account statement. I've pulled these from your profile into a checklist for you.";
  return "Good question. In short: act before the deadline, keep it in writing, and let me prepare the document so the wording is correct.";
}

/** "What comes next" — a small process map per letter. */
export const PROCESS_STEPS: Record<string, ProcessStep[]> = {
  ltr_finanzamt: [
    {
      id: "p1",
      title: "Assessment received",
      detail: "The Finanzamt set your tax for 2024.",
      state: "done",
    },
    {
      id: "p2",
      title: "Object or pay",
      detail: "File an Einspruch, or pay €412.",
      state: "current",
      whenHint: "within 2 weeks",
    },
    {
      id: "p3",
      title: "They review",
      detail: "The office re-checks the figures.",
      state: "upcoming",
      whenHint: "in ~4–8 weeks",
    },
    {
      id: "p4",
      title: "Final decision",
      detail: "A corrected assessment or confirmation arrives.",
      state: "upcoming",
    },
  ],
  ltr_auslander: [
    {
      id: "p1",
      title: "Appointment booked",
      detail: "The LEA invited you to extend your permit.",
      state: "done",
    },
    {
      id: "p2",
      title: "Bring your documents",
      detail: "Attend with the full checklist.",
      state: "current",
      whenHint: "in 9 days",
    },
    {
      id: "p3",
      title: "Fiktionsbescheinigung",
      detail: "You get a temporary proof while they process.",
      state: "upcoming",
    },
    {
      id: "p4",
      title: "New permit issued",
      detail: "Your extended residence permit is ready to collect.",
      state: "upcoming",
      whenHint: "in ~6–10 weeks",
    },
  ],
};

/**
 * Extra calendar appointments (not deadlines). Merged with real deadlines from
 * the /deadlines endpoint to fill the calendar.
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
  {
    id: "evt_rem_rundfunk",
    letterId: "ltr_rundfunk",
    title: "Reminder: submit Rundfunk exemption",
    date: at(1, 18, 0),
    kind: "reminder",
    urgency: "urgent",
  },
];
