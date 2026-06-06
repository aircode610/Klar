/**
 * Frontend-only data for features the backend does not (yet) provide: the local
 * profile vault (used to pre-fill the generated reply) and the chat's suggested
 * questions. The per-letter chat itself is grounded in the real /rag/search.
 * See types/extra.ts.
 */
import type { ProfileField } from "@/types/extra";

/** The profile vault — local, user-owned details used to pre-fill replies. */
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
