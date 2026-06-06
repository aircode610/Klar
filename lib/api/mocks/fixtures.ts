import type { AppConfig, Letter, Me } from "@/types";

/**
 * Mock data for the whole app while NEXT_PUBLIC_API_MODE=mock.
 * Three realistic German letters: a Finanzamt assessment, a Rundfunkbeitrag fee
 * demand, and an Anmeldung confirmation. Content is in English (the demo default)
 * — the contract has the backend localise per Accept-Language; the mock does not.
 */

export const PER_LETTER_PRICE = { amount: 499, currency: "EUR" } as const;

export const mockConfig: AppConfig = {
  perLetterPrice: PER_LETTER_PRICE,
  plans: [
    {
      id: "flat-monthly",
      name: "Bürokratie-Flat",
      price: { amount: 699, currency: "EUR" },
      interval: "month",
      features: [
        "Unlimited letters",
        "Every reply and form, done for you",
        "Deadline tracking and reminders",
      ],
    },
  ],
  supportedLanguages: ["en", "de", "fa", "tr", "ar", "uk"],
};

export const mockMe: Me = {
  sessionId: "sess_mock_001",
  language: "en",
  subscription: { active: false, planId: null, renewsAt: null },
  lettersCount: 3,
};

/** Full generated outputs, revealed once unlocked. Keyed by letter id. */
export const SAMPLE_OUTPUTS: Record<
  string,
  { bodyText: string; downloadUrl: string }
> = {
  ltr_finanzamt: {
    bodyText: `Finanzamt Hamburg-Mitte
Steuernummer: 22/345/67890

Betreff: Einspruch gegen den Einkommensteuerbescheid 2024

Sehr geehrte Damen und Herren,

hiermit lege ich form- und fristgerecht Einspruch gegen den oben genannten Einkommensteuerbescheid vom 12. Mai 2026 ein.

Die Festsetzung berücksichtigt meine als Werbungskosten geltend gemachten Aufwendungen nicht vollständig. Ich bitte um erneute Prüfung und um Aussetzung der Vollziehung bis zur Entscheidung über diesen Einspruch.

Die entsprechenden Belege reiche ich gesondert nach.

Mit freundlichen Grüßen`,
    downloadUrl: "/mock/finanzamt-einspruch.pdf",
  },
  ltr_rundfunk: {
    bodyText: `ARD ZDF Deutschlandradio Beitragsservice
50656 Köln

Betreff: Antrag auf Befreiung von der Rundfunkbeitragspflicht

Sehr geehrte Damen und Herren,

hiermit beantrage ich die Befreiung von der Rundfunkbeitragspflicht, da ich Leistungen nach dem BAföG beziehe. Den entsprechenden Bewilligungsbescheid füge ich in Kopie bei.

Ich bitte um Bestätigung der Befreiung sowie um Stornierung der offenen Forderung.

Mit freundlichen Grüßen`,
    downloadUrl: "/mock/rundfunk-befreiung.pdf",
  },
};

/**
 * Returns a fresh deep copy of the seed letters so the in-memory mock store can
 * mutate them per session without leaking state across reloads.
 */
export function seedLetters(): Letter[] {
  const now = Date.now();
  const day = 86_400_000;
  const iso = (ms: number) => new Date(ms).toISOString();

  return [
    {
      id: "ltr_finanzamt",
      status: "ready",
      createdAt: iso(now - 2 * day),
      thumbnailUrl: null,
      handled: false,
      sender: "Finanzamt Hamburg-Mitte",
      documentType: "Income tax assessment",
      referenceNumber: "22/345/67890",
      summary:
        "The tax office says you owe €412 for 2024. You can object, but only for the next two weeks.",
      whatItWants:
        "Pay €412 by the due date, or file a written objection if the figures look wrong.",
      consequence:
        "Miss the objection window and the assessment becomes final — you lose the right to dispute it.",
      deadline: {
        date: iso(now + 14 * day),
        label: "Object by 20 June",
        urgency: "soon",
        daysRemaining: 14,
      },
      recommendedActions: [
        { id: "a1", text: "File a written objection", primary: true },
        { id: "a2", text: "Gather your 2024 expense receipts", primary: false },
      ],
      output: {
        type: "reply_letter",
        locked: true,
        available: false,
        previewText:
          "Betreff: Einspruch gegen den Einkommensteuerbescheid 2024\n\nSehr geehrte Damen und Herren, hiermit lege ich form- und fristgerecht Einspruch …",
        bodyText: null,
        downloadUrl: null,
        price: PER_LETTER_PRICE,
      },
      originalText: `Finanzamt Hamburg-Mitte
Steuernummer 22/345/67890

Bescheid für 2024 über Einkommensteuer

Festgesetzt werden: Einkommensteuer 412,00 EUR.
Der Betrag ist innerhalb eines Monats nach Bekanntgabe dieses Bescheids fällig.

Rechtsbehelfsbelehrung: Gegen diesen Bescheid kann innerhalb eines Monats nach Bekanntgabe Einspruch eingelegt werden. Der Einspruch ist schriftlich beim Finanzamt einzureichen.`,
      confidence: 0.96,
    },
    {
      id: "ltr_rundfunk",
      status: "ready",
      createdAt: iso(now - 1 * day),
      thumbnailUrl: null,
      handled: false,
      sender: "ARD ZDF Deutschlandradio Beitragsservice",
      documentType: "Broadcasting fee demand",
      referenceNumber: "BS-901 234 567",
      summary:
        "The broadcasting service wants €110.40 in unpaid radio/TV fees. If you receive BAföG, you can apply to be exempted instead.",
      whatItWants: "Pay €110.40, or apply for an exemption if you qualify.",
      consequence:
        "Ignore it and a reminder fee is added, then the debt can be enforced through a collection order.",
      deadline: {
        date: iso(now + 4 * day),
        label: "Pay by 10 June",
        urgency: "urgent",
        daysRemaining: 4,
      },
      recommendedActions: [
        { id: "a1", text: "Apply for a fee exemption", primary: true },
        { id: "a2", text: "Or pay €110.40 to settle it", primary: false },
      ],
      output: {
        type: "filled_form",
        locked: true,
        available: false,
        previewText:
          "Antrag auf Befreiung von der Rundfunkbeitragspflicht\n\nHiermit beantrage ich die Befreiung, da ich Leistungen nach dem BAföG beziehe …",
        bodyText: null,
        downloadUrl: null,
        price: PER_LETTER_PRICE,
      },
      originalText: `ARD ZDF Deutschlandradio Beitragsservice
Beitragsnummer 901 234 567

Zahlungsaufforderung

Für den Zeitraum 01/2026 bis 06/2026 sind Rundfunkbeiträge in Höhe von 110,40 EUR offen. Bitte überweisen Sie den Betrag bis zum angegebenen Datum. Bei Nichtzahlung wird ein Säumniszuschlag erhoben.`,
      confidence: 0.91,
    },
    {
      id: "ltr_anmeldung",
      status: "ready",
      createdAt: iso(now - 6 * day),
      thumbnailUrl: null,
      handled: true,
      sender: "Bürgeramt Berlin-Mitte",
      documentType: "Registration confirmation",
      referenceNumber: "AM-2026-558120",
      summary:
        "This is your Anmeldung confirmation — proof that you are officially registered at your address. Keep it safe; banks and employers ask for it.",
      whatItWants: "Nothing. This is for your records.",
      consequence: "No action needed. There is no deadline on this one.",
      deadline: null,
      recommendedActions: [
        { id: "a1", text: "Save a copy for your records", primary: true },
      ],
      output: {
        type: "none",
        locked: false,
        available: false,
        previewText: null,
        bodyText: null,
        downloadUrl: null,
        price: null,
      },
      originalText: `Bürgeramt Berlin-Mitte
Meldebestätigung

Hiermit wird bestätigt, dass die oben genannte Person unter der angegebenen Anschrift mit Hauptwohnsitz gemeldet ist. Tag des Einzugs: siehe Meldedaten.`,
      confidence: 0.99,
    },
  ];
}
