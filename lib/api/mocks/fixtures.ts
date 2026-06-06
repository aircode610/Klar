import type { AppConfig, Letter, Me } from "@/types";

/**
 * Mock data for the whole app while NEXT_PUBLIC_API_MODE=mock.
 * A rich, varied set of German letters spanning every urgency state, so the
 * prototype feels full. Content is English (the demo default); the contract has
 * the backend localise per Accept-Language.
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
        "Unlimited letters, read and explained",
        "Every reply and form, done for you",
        "Deadline tracking, reminders and calendar",
        "Your details saved — forms fill themselves",
      ],
    },
    {
      id: "flat-yearly",
      name: "Bürokratie-Flat (yearly)",
      price: { amount: 5900, currency: "EUR" },
      interval: "year",
      features: [
        "Everything in the monthly plan",
        "Two months free",
        "Priority document reading",
      ],
    },
  ],
  supportedLanguages: ["en", "de", "fa", "tr", "ar", "uk"],
};

export const mockMe: Me = {
  sessionId: "sess_mock_001",
  language: "en",
  subscription: { active: false, planId: null, renewsAt: null },
  lettersCount: 7,
};

const day = 86_400_000;

/** Build an ISO timestamp N days from now at a given hour:minute (local-ish). */
function at(daysFromNow: number, hour = 9, minute = 0): string {
  const d = new Date(Date.now() + daysFromNow * day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function daysFrom(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / day);
}

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

Mit freundlichen Grüßen
Danial Eyvazi`,
    downloadUrl: "/mock/finanzamt-einspruch.pdf",
  },
  ltr_rundfunk: {
    bodyText: `ARD ZDF Deutschlandradio Beitragsservice
50656 Köln

Betreff: Antrag auf Befreiung von der Rundfunkbeitragspflicht

Sehr geehrte Damen und Herren,

hiermit beantrage ich die Befreiung von der Rundfunkbeitragspflicht, da ich Leistungen nach dem BAföG beziehe. Den entsprechenden Bewilligungsbescheid füge ich in Kopie bei.

Ich bitte um Bestätigung der Befreiung sowie um Stornierung der offenen Forderung.

Mit freundlichen Grüßen
Danial Eyvazi`,
    downloadUrl: "/mock/rundfunk-befreiung.pdf",
  },
  ltr_strafzettel: {
    bodyText: `Bußgeldstelle Berlin
Aktenzeichen: 90.123.456.7

Betreff: Einspruch gegen den Bußgeldbescheid

Sehr geehrte Damen und Herren,

gegen den Bußgeldbescheid vom 28. Mai 2026 lege ich hiermit fristgerecht Einspruch ein.

Ich bestreite den vorgeworfenen Sachverhalt und bitte um Übersendung der Akteneinsicht, insbesondere des Messprotokolls und des Eichscheins des verwendeten Messgeräts.

Mit freundlichen Grüßen
Danial Eyvazi`,
    downloadUrl: "/mock/bussgeld-einspruch.pdf",
  },
  ltr_jobcenter: {
    bodyText: `Jobcenter Berlin Mitte
BG-Nummer: 12345/0098765

Betreff: Einreichung der angeforderten Unterlagen

Sehr geehrte Damen und Herren,

anbei übersende ich die mit Ihrem Schreiben angeforderten Unterlagen: aktuelle Mietbescheinigung, Kontoauszüge der letzten drei Monate sowie die Verdienstbescheinigung.

Ich bitte um Fortführung der Bearbeitung meines Antrags.

Mit freundlichen Grüßen
Danial Eyvazi`,
    downloadUrl: "/mock/jobcenter-unterlagen.pdf",
  },
  ltr_auslander: {
    bodyText: `Ausländerbehörde Berlin (LEA)
Kundennummer: A-2026-44219

Betreff: Verlängerung der Aufenthaltserlaubnis (§ 16b AufenthG)

Sehr geehrte Damen und Herren,

hiermit beantrage ich die Verlängerung meiner Aufenthaltserlaubnis zum Zweck des Studiums. Folgende Unterlagen lege ich bei: gültiger Reisepass, Immatrikulationsbescheinigung, Nachweis der Krankenversicherung sowie der Finanzierungsnachweis (Sperrkonto).

Ich bitte um einen zeitnahen Termin zur Vorsprache.

Mit freundlichen Grüßen
Danial Eyvazi`,
    downloadUrl: "/mock/lea-verlaengerung.pdf",
  },
  ltr_krankenkasse: {
    bodyText: `Techniker Krankenkasse
Versichertennummer: T-998877665

Betreff: Widerspruch gegen die Beitragseinstufung

Sehr geehrte Damen und Herren,

gegen die mit Schreiben vom 20. Mai 2026 mitgeteilte Beitragseinstufung lege ich Widerspruch ein. Meine Einkünfte haben sich verringert; die aktuellen Nachweise füge ich bei und bitte um Neuberechnung des Beitrags.

Mit freundlichen Grüßen
Danial Eyvazi`,
    downloadUrl: "/mock/tk-widerspruch.pdf",
  },
};

/**
 * Returns a fresh deep copy of the seed letters so the in-memory mock store can
 * mutate them per session without leaking state across reloads.
 */
export function seedLetters(): Letter[] {
  const reply = (preview: string) => ({
    type: "reply_letter" as const,
    locked: true,
    available: false,
    previewText: preview,
    bodyText: null,
    downloadUrl: null,
    price: PER_LETTER_PRICE,
  });
  const form = (preview: string) => ({
    type: "filled_form" as const,
    locked: true,
    available: false,
    previewText: preview,
    bodyText: null,
    downloadUrl: null,
    price: PER_LETTER_PRICE,
  });

  return [
    {
      id: "ltr_strafzettel",
      status: "ready",
      createdAt: at(-3, 8, 30),
      thumbnailUrl: null,
      handled: false,
      sender: "Bußgeldstelle Berlin",
      documentType: "Traffic fine",
      referenceNumber: "90.123.456.7",
      summary:
        "A €60 parking fine — and the deadline to object has already passed by two days. Act now to limit the damage.",
      whatItWants:
        "Pay €60, or file an objection. The window to object closed two days ago, so move fast.",
      consequence:
        "Each week it grows: a reminder fee, then a payment order, then enforcement. It will not go away on its own.",
      deadline: {
        date: at(-2, 23, 59),
        label: "Was due 2 days ago",
        urgency: "overdue",
        daysRemaining: -2,
      },
      recommendedActions: [
        { id: "a1", text: "File an objection immediately", primary: true },
        { id: "a2", text: "Request to see the measurement record", primary: false },
      ],
      output: form(
        "Betreff: Einspruch gegen den Bußgeldbescheid\n\nGegen den Bußgeldbescheid vom 28. Mai 2026 lege ich Einspruch ein …",
      ),
      originalText: `Bußgeldstelle Berlin
Aktenzeichen 90.123.456.7

Bußgeldbescheid

Ihnen wird vorgeworfen, am 24.05.2026 im absoluten Halteverbot geparkt zu haben. Es wird ein Verwarnungsgeld in Höhe von 60,00 EUR festgesetzt. Der Betrag ist innerhalb von zwei Wochen zu zahlen. Gegen diesen Bescheid kann innerhalb von zwei Wochen Einspruch eingelegt werden.`,
      confidence: 0.93,
    },
    {
      id: "ltr_rundfunk",
      status: "ready",
      createdAt: at(-1, 10, 15),
      thumbnailUrl: null,
      handled: false,
      sender: "ARD ZDF Deutschlandradio Beitragsservice",
      documentType: "Broadcasting fee demand",
      referenceNumber: "BS-901 234 567",
      summary:
        "The broadcasting service wants €110.40 in unpaid radio/TV fees. If you receive BAföG, you can apply to be exempted instead of paying.",
      whatItWants: "Pay €110.40, or apply for an exemption if you qualify.",
      consequence:
        "Ignore it and a reminder fee is added, then the debt can be enforced through a collection order.",
      deadline: {
        date: at(3, 12, 0),
        label: "Pay by " + new Date(at(3)).toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
        urgency: "urgent",
        daysRemaining: daysFrom(at(3, 12, 0)),
      },
      recommendedActions: [
        { id: "a1", text: "Apply for a fee exemption", primary: true },
        { id: "a2", text: "Or pay €110.40 to settle it", primary: false },
      ],
      output: form(
        "Antrag auf Befreiung von der Rundfunkbeitragspflicht\n\nHiermit beantrage ich die Befreiung, da ich Leistungen nach dem BAföG beziehe …",
      ),
      originalText: `ARD ZDF Deutschlandradio Beitragsservice
Beitragsnummer 901 234 567

Zahlungsaufforderung

Für den Zeitraum 01/2026 bis 06/2026 sind Rundfunkbeiträge in Höhe von 110,40 EUR offen. Bitte überweisen Sie den Betrag bis zum angegebenen Datum. Bei Nichtzahlung wird ein Säumniszuschlag erhoben.`,
      confidence: 0.91,
    },
    {
      id: "ltr_jobcenter",
      status: "ready",
      createdAt: at(-1, 16, 40),
      thumbnailUrl: null,
      handled: false,
      sender: "Jobcenter Berlin Mitte",
      documentType: "Request for documents",
      referenceNumber: "12345/0098765",
      summary:
        "The Jobcenter needs three documents from you to keep your support running. Send them in within the week.",
      whatItWants:
        "Submit your rent certificate, the last three bank statements, and a proof of earnings.",
      consequence:
        "Miss the date and your payments can be paused until the paperwork arrives.",
      deadline: {
        date: at(6, 9, 0),
        label: "Submit by " + new Date(at(6)).toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
        urgency: "urgent",
        daysRemaining: daysFrom(at(6, 9, 0)),
      },
      recommendedActions: [
        { id: "a1", text: "Send the requested documents", primary: true },
      ],
      output: form(
        "Betreff: Einreichung der angeforderten Unterlagen\n\nAnbei übersende ich die angeforderten Unterlagen …",
      ),
      originalText: `Jobcenter Berlin Mitte
BG-Nummer 12345/0098765

Mitwirkungsaufforderung

Zur abschließenden Bearbeitung Ihres Antrags benötigen wir folgende Unterlagen: aktuelle Mietbescheinigung, Kontoauszüge der letzten drei Monate, Verdienstbescheinigung. Bitte reichen Sie diese fristgerecht ein.`,
      confidence: 0.95,
    },
    {
      id: "ltr_auslander",
      status: "ready",
      createdAt: at(-2, 11, 5),
      thumbnailUrl: null,
      handled: false,
      sender: "Ausländerbehörde Berlin (LEA)",
      documentType: "Residence permit — appointment",
      referenceNumber: "A-2026-44219",
      summary:
        "Your residence permit expires soon. The LEA has given you an appointment to extend it — bring the listed documents.",
      whatItWants:
        "Attend the appointment with your passport, enrolment certificate, insurance and blocked-account proof.",
      consequence:
        "Let the permit lapse and your legal stay is at risk. This is the one you do not miss.",
      deadline: {
        date: at(9, 10, 30),
        label: "Appointment " + new Date(at(9)).toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
        urgency: "soon",
        daysRemaining: daysFrom(at(9, 10, 30)),
      },
      recommendedActions: [
        { id: "a1", text: "Prepare the document checklist", primary: true },
        { id: "a2", text: "Fill the extension application", primary: false },
      ],
      output: form(
        "Betreff: Verlängerung der Aufenthaltserlaubnis (§ 16b AufenthG)\n\nHiermit beantrage ich die Verlängerung meiner Aufenthaltserlaubnis …",
      ),
      originalText: `Ausländerbehörde Berlin (LEA)
Kundennummer A-2026-44219

Terminbestätigung — Verlängerung Aufenthaltstitel

Ihr Termin: siehe Datum. Bitte bringen Sie folgende Unterlagen mit: gültiger Reisepass, Immatrikulationsbescheinigung, Nachweis Krankenversicherung, Finanzierungsnachweis (Sperrkonto), aktuelles biometrisches Lichtbild.`,
      confidence: 0.88,
    },
    {
      id: "ltr_finanzamt",
      status: "ready",
      createdAt: at(-4, 9, 0),
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
        date: at(14, 9, 0),
        label: "Object by " + new Date(at(14)).toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
        urgency: "soon",
        daysRemaining: daysFrom(at(14, 9, 0)),
      },
      recommendedActions: [
        { id: "a1", text: "File a written objection", primary: true },
        { id: "a2", text: "Gather your 2024 expense receipts", primary: false },
      ],
      output: reply(
        "Betreff: Einspruch gegen den Einkommensteuerbescheid 2024\n\nSehr geehrte Damen und Herren, hiermit lege ich form- und fristgerecht Einspruch …",
      ),
      originalText: `Finanzamt Hamburg-Mitte
Steuernummer 22/345/67890

Bescheid für 2024 über Einkommensteuer

Festgesetzt werden: Einkommensteuer 412,00 EUR.
Der Betrag ist innerhalb eines Monats nach Bekanntgabe dieses Bescheids fällig.

Rechtsbehelfsbelehrung: Gegen diesen Bescheid kann innerhalb eines Monats nach Bekanntgabe Einspruch eingelegt werden. Der Einspruch ist schriftlich beim Finanzamt einzureichen.`,
      confidence: 0.96,
    },
    {
      id: "ltr_krankenkasse",
      status: "ready",
      createdAt: at(-5, 14, 0),
      thumbnailUrl: null,
      handled: false,
      sender: "Techniker Krankenkasse",
      documentType: "Insurance contribution change",
      referenceNumber: "T-998877665",
      summary:
        "Your health insurance recalculated your monthly contribution. If your income dropped, you can object and have it lowered.",
      whatItWants:
        "Accept the new amount, or object with proof of your current income.",
      consequence:
        "If you do nothing, the new higher contribution simply applies from next month.",
      deadline: {
        date: at(21, 9, 0),
        label: "Respond by " + new Date(at(21)).toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
        urgency: "normal",
        daysRemaining: daysFrom(at(21, 9, 0)),
      },
      recommendedActions: [
        { id: "a1", text: "Object with updated income proof", primary: true },
      ],
      output: reply(
        "Betreff: Widerspruch gegen die Beitragseinstufung\n\nGegen die Beitragseinstufung lege ich Widerspruch ein …",
      ),
      originalText: `Techniker Krankenkasse
Versichertennummer T-998877665

Beitragsmitteilung

Auf Grundlage der vorliegenden Daten wird Ihr monatlicher Beitrag neu festgesetzt. Sollten sich Ihre Einkünfte geändert haben, können Sie innerhalb eines Monats Widerspruch einlegen.`,
      confidence: 0.9,
    },
    {
      id: "ltr_anmeldung",
      status: "ready",
      createdAt: at(-12, 13, 20),
      thumbnailUrl: null,
      handled: true,
      sender: "Bürgeramt Berlin-Mitte",
      documentType: "Registration confirmation",
      referenceNumber: "AM-2026-558120",
      summary:
        "This is your Anmeldung confirmation — proof you are officially registered at your address. Keep it safe; banks and employers ask for it.",
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

Hiermit wird bestätigt, dass die oben genannte Person unter der angegebenen Anschrift mit Hauptwohnsitz gemeldet ist.`,
      confidence: 0.99,
    },
  ];
}
