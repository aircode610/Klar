import type { Letter, RiskBreakdown } from "@/types";

/**
 * Mock data shaped exactly like the FastAPI backend's LetterResponse, plus the
 * richer fields the new features expect (ocr_text, confidence, per-action risk
 * breakdown, deadline confidence). Obligation-centric.
 */

const DAY = 86_400_000;

/** YYYY-MM-DD, N days from today. */
function date(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * DAY).toISOString().slice(0, 10);
}

let counter = 1;
const aid = () => `act_${counter++}`;

/** Mirrors the backend's deterministic risk formula (DeadlinePivot §4.5). */
function risk(dp: number, iw: number, sp: number, mp: number): RiskBreakdown {
  const score = Math.round((dp * 0.4 + iw * 0.3 + sp * 0.2 + mp * 0.1) * 100);
  return {
    score,
    deadline_proximity_pts: dp,
    institution_weight: iw,
    severity_pts: sp,
    missing_info_penalty: mp,
    explanation: [
      `deadline_proximity=${dp.toFixed(2)} (×0.40)`,
      `institution_weight=${iw.toFixed(2)} (×0.30)`,
      `severity=${sp.toFixed(2)} (×0.20)`,
      `missing_info_penalty=${mp.toFixed(2)} (×0.10)`,
    ].join(" · "),
  };
}

export function seedLetters(): Letter[] {
  const rStraf = risk(1.0, 0.55, 0.75, 0.0);
  const rRund = risk(0.85, 0.55, 0.5, 0.0);
  const rJob = risk(0.65, 0.4, 0.75, 0.0);
  const rLea = risk(0.45, 1.0, 1.0, 0.0);
  const rFin = risk(0.45, 0.9, 0.5, 0.0);
  const rKv = risk(0.25, 0.85, 0.25, 0.0);
  const rAnm = risk(0.5, 0.4, 0.25, 0.5);

  return [
    {
      id: "ltr_strafzettel",
      institution: "Bußgeldstelle Berlin",
      document_type: "Bußgeldbescheid",
      category: "legal_debt",
      summary_en:
        "A €60 parking fine. The window to object has already passed by two days — act now to limit the cost.",
      extraction_warnings: ["Objection deadline appears to have passed."],
      confidence: 0.93,
      ocr_text:
        "Bußgeldstelle Berlin\nAktenzeichen 90.123.456.7\n\nBußgeldbescheid\n\nIhnen wird vorgeworfen, am 24.05.2026 im absoluten Halteverbot geparkt zu haben. Es wird ein Verwarnungsgeld in Höhe von 60,00 EUR festgesetzt. Der Betrag ist innerhalb von zwei Wochen zu zahlen. Gegen diesen Bescheid kann innerhalb von zwei Wochen Einspruch eingelegt werden.",
      actions: [
        {
          id: aid(),
          title: "Pay the €60 fine or file an objection",
          description:
            "The two-week objection window has closed. Paying now avoids reminder fees and enforcement.",
          deadline: date(-2),
          deadline_confidence: 0.95,
          deadline_source: "explicit",
          severity: "high",
          risk_score: rStraf.score,
          risk: rStraf,
          status: "open",
          reply_needed: true,
          steps: [
            "Decide whether to pay (€60) or contest the fine",
            "If contesting, request the measurement record (Akteneinsicht)",
            "Pay via the reference number to stop further fees",
          ],
          evidence_span:
            "Der Betrag ist innerhalb von zwei Wochen zu zahlen. Gegen diesen Bescheid kann innerhalb von zwei Wochen Einspruch eingelegt werden.",
        },
      ],
    },
    {
      id: "ltr_rundfunk",
      institution: "Beitragsservice ARD ZDF Deutschlandradio",
      document_type: "Zahlungsaufforderung",
      category: "broadcast_fee",
      summary_en:
        "The broadcasting service wants €110.40 in unpaid radio/TV fees. If you receive BAföG you can apply to be exempted.",
      extraction_warnings: [],
      confidence: 0.91,
      ocr_text:
        "ARD ZDF Deutschlandradio Beitragsservice\nBeitragsnummer 901 234 567\n\nZahlungsaufforderung\n\nFür den Zeitraum 01/2026 bis 06/2026 sind Rundfunkbeiträge in Höhe von 110,40 EUR offen. Bitte überweisen Sie den Betrag bis zum angegebenen Datum. Bei Nichtzahlung wird ein Säumniszuschlag erhoben.",
      actions: [
        {
          id: aid(),
          title: "Pay €110.40 or apply for an exemption",
          description: "Students on BAföG can be exempted from the Rundfunkbeitrag.",
          deadline: date(3),
          deadline_confidence: 0.8,
          deadline_source: "inferred",
          severity: "medium",
          risk_score: rRund.score,
          risk: rRund,
          status: "open",
          reply_needed: true,
          steps: [
            "Check whether you qualify for a Befreiung (e.g. BAföG)",
            "Submit the exemption application with proof",
            "Otherwise transfer €110.40 to the stated account",
          ],
          evidence_span:
            "Für den Zeitraum 01/2026 bis 06/2026 sind Rundfunkbeiträge in Höhe von 110,40 EUR offen.",
        },
      ],
    },
    {
      id: "ltr_jobcenter",
      institution: "Jobcenter Berlin Mitte",
      document_type: "Mitwirkungsaufforderung",
      category: "government_benefits",
      summary_en:
        "The Jobcenter needs three documents from you to keep your support running. Send them within the week.",
      extraction_warnings: [],
      confidence: 0.95,
      ocr_text:
        "Jobcenter Berlin Mitte\nBG-Nummer 12345/0098765\n\nMitwirkungsaufforderung\n\nZur abschließenden Bearbeitung Ihres Antrags benötigen wir folgende Unterlagen: aktuelle Mietbescheinigung, Kontoauszüge der letzten drei Monate, Verdienstbescheinigung. Bitte reichen Sie diese fristgerecht ein.",
      actions: [
        {
          id: aid(),
          title: "Submit rent certificate, bank statements and proof of earnings",
          description: "Required to continue processing your benefits.",
          deadline: date(6),
          deadline_confidence: 0.9,
          deadline_source: "explicit",
          severity: "high",
          risk_score: rJob.score,
          risk: rJob,
          status: "open",
          reply_needed: true,
          steps: [
            "Get a current Mietbescheinigung from your landlord",
            "Download the last three months of bank statements",
            "Add your latest Verdienstbescheinigung",
            "Upload or post everything with your BG-Nummer",
          ],
          evidence_span:
            "Zur abschließenden Bearbeitung Ihres Antrags benötigen wir folgende Unterlagen: Mietbescheinigung, Kontoauszüge der letzten drei Monate, Verdienstbescheinigung.",
        },
      ],
    },
    {
      id: "ltr_auslander",
      institution: "Ausländerbehörde Berlin",
      document_type: "Terminbestätigung",
      category: "immigration",
      summary_en:
        "Your residence permit expires soon. The Ausländerbehörde has given you an appointment to extend it — bring the listed documents.",
      extraction_warnings: ["Low confidence on the appointment time — verify against the letter."],
      confidence: 0.82,
      ocr_text:
        "Ausländerbehörde Berlin (LEA)\nKundennummer A-2026-44219\n\nTerminbestätigung — Verlängerung Aufenthaltstitel\n\nIhr Termin: siehe Datum. Bitte bringen Sie folgende Unterlagen mit: gültiger Reisepass, Immatrikulationsbescheinigung, Nachweis Krankenversicherung, Finanzierungsnachweis (Sperrkonto), aktuelles biometrisches Lichtbild.",
      actions: [
        {
          id: aid(),
          title: "Attend the appointment with the full document set",
          description: "Missing this risks a gap in your legal residence status.",
          deadline: date(9),
          deadline_confidence: 0.6,
          deadline_source: "inferred",
          severity: "critical",
          risk_score: rLea.score,
          risk: rLea,
          status: "open",
          reply_needed: false,
          steps: [
            "Valid passport",
            "Enrolment certificate (Immatrikulationsbescheinigung)",
            "Proof of health insurance",
            "Blocked-account statement (Sperrkonto)",
            "Current biometric photo",
          ],
          evidence_span:
            "Bitte bringen Sie folgende Unterlagen mit: gültiger Reisepass, Immatrikulationsbescheinigung, Nachweis Krankenversicherung, Finanzierungsnachweis (Sperrkonto).",
        },
      ],
    },
    {
      id: "ltr_finanzamt",
      institution: "Finanzamt Hamburg-Mitte",
      document_type: "Steuerbescheid",
      category: "tax",
      summary_en:
        "The tax office assessed €412 owed for 2024. You can object within one month if the figures look wrong.",
      extraction_warnings: [],
      confidence: 0.96,
      ocr_text:
        "Finanzamt Hamburg-Mitte\nSteuernummer 22/345/67890\n\nBescheid für 2024 über Einkommensteuer\n\nFestgesetzt werden: Einkommensteuer 412,00 EUR. Der Betrag ist innerhalb eines Monats nach Bekanntgabe dieses Bescheids fällig.\n\nRechtsbehelfsbelehrung: Gegen diesen Bescheid kann innerhalb eines Monats nach Bekanntgabe Einspruch eingelegt werden.",
      actions: [
        {
          id: aid(),
          title: "Pay €412 or file an objection (Einspruch)",
          deadline: date(14),
          deadline_confidence: 0.92,
          deadline_source: "explicit",
          severity: "medium",
          risk_score: rFin.score,
          risk: rFin,
          status: "open",
          reply_needed: true,
          steps: [
            "Check the assessment against your records",
            "If wrong, file a written Einspruch within one month",
            "Otherwise pay €412 by the due date",
          ],
          evidence_span:
            "Gegen diesen Bescheid kann innerhalb eines Monats nach Bekanntgabe Einspruch eingelegt werden.",
        },
      ],
    },
    {
      id: "ltr_krankenkasse",
      institution: "Techniker Krankenkasse",
      document_type: "Beitragsmitteilung",
      category: "health_insurance",
      summary_en:
        "Your health insurance recalculated your monthly contribution. If your income dropped you can object and have it lowered.",
      extraction_warnings: [],
      confidence: 0.9,
      ocr_text:
        "Techniker Krankenkasse\nVersichertennummer T-998877665\n\nBeitragsmitteilung\n\nAuf Grundlage der vorliegenden Daten wird Ihr monatlicher Beitrag neu festgesetzt. Sollten sich Ihre Einkünfte geändert haben, können Sie innerhalb eines Monats Widerspruch einlegen.",
      actions: [
        {
          id: aid(),
          title: "Accept the new contribution or object with income proof",
          deadline: date(21),
          deadline_confidence: 0.85,
          deadline_source: "explicit",
          severity: "low",
          risk_score: rKv.score,
          risk: rKv,
          status: "open",
          reply_needed: true,
          steps: [
            "Compare the new amount with your current income",
            "If lower, send a Widerspruch with proof within one month",
          ],
          evidence_span:
            "Sollten sich Ihre Einkünfte geändert haben, können Sie innerhalb eines Monats Widerspruch einlegen.",
        },
      ],
    },
    {
      id: "ltr_anmeldung",
      institution: "Bürgeramt Berlin-Mitte",
      document_type: "Meldebestätigung",
      category: "civic",
      summary_en:
        "This is your Anmeldung confirmation — proof you are officially registered at your address. Keep it safe.",
      extraction_warnings: [],
      confidence: 0.99,
      ocr_text:
        "Bürgeramt Berlin-Mitte\nMeldebestätigung\n\nHiermit wird bestätigt, dass die oben genannte Person unter der angegebenen Anschrift mit Hauptwohnsitz gemeldet ist.",
      actions: [
        {
          id: aid(),
          title: "Save a copy for your records",
          deadline: null,
          deadline_source: "unknown",
          severity: "low",
          risk_score: rAnm.score,
          risk: rAnm,
          status: "done",
          reply_needed: false,
          steps: ["Store a digital and paper copy"],
          evidence_span:
            "Hiermit wird bestätigt, dass die oben genannte Person unter der angegebenen Anschrift gemeldet ist.",
        },
      ],
    },
  ];
}

/** German Behördendeutsch reply drafts, keyed by letter id (and "fresh"). */
export const SAMPLE_REPLIES: Record<string, string> = {
  ltr_strafzettel: `Bußgeldstelle Berlin
Aktenzeichen: 90.123.456.7

Betreff: Einspruch gegen den Bußgeldbescheid

Sehr geehrte Damen und Herren,

gegen den oben genannten Bußgeldbescheid lege ich hiermit fristgerecht Einspruch ein.

Ich bestreite den vorgeworfenen Sachverhalt und beantrage Akteneinsicht, insbesondere in das Messprotokoll und den Eichschein des verwendeten Geräts.

Mit freundlichen Grüßen
{name}
{address}`,
  ltr_rundfunk: `ARD ZDF Deutschlandradio Beitragsservice
50656 Köln
Beitragsnummer: 901 234 567

Betreff: Antrag auf Befreiung von der Rundfunkbeitragspflicht

Sehr geehrte Damen und Herren,

hiermit beantrage ich die Befreiung von der Rundfunkbeitragspflicht, da ich Leistungen nach dem BAföG beziehe. Den entsprechenden Bewilligungsbescheid füge ich in Kopie bei.

Ich bitte um Bestätigung der Befreiung sowie um Stornierung der offenen Forderung.

Mit freundlichen Grüßen
{name}
{address}`,
  ltr_jobcenter: `Jobcenter Berlin Mitte
BG-Nummer: 12345/0098765

Betreff: Einreichung der angeforderten Unterlagen

Sehr geehrte Damen und Herren,

anbei übersende ich die angeforderten Unterlagen: aktuelle Mietbescheinigung, Kontoauszüge der letzten drei Monate sowie die Verdienstbescheinigung.

Ich bitte um Fortführung der Bearbeitung meines Antrags.

Mit freundlichen Grüßen
{name}
{address}`,
  ltr_finanzamt: `Finanzamt Hamburg-Mitte
Steuernummer: 22/345/67890

Betreff: Einspruch gegen den Einkommensteuerbescheid 2024

Sehr geehrte Damen und Herren,

hiermit lege ich form- und fristgerecht Einspruch gegen den oben genannten Bescheid ein und bitte um Aussetzung der Vollziehung.

Die als Werbungskosten geltend gemachten Aufwendungen wurden nicht vollständig berücksichtigt; entsprechende Belege reiche ich nach.

Mit freundlichen Grüßen
{name}
{address}`,
  ltr_krankenkasse: `Techniker Krankenkasse
Versichertennummer: T-998877665

Betreff: Widerspruch gegen die Beitragseinstufung

Sehr geehrte Damen und Herren,

gegen die mitgeteilte Beitragseinstufung lege ich Widerspruch ein. Meine Einkünfte haben sich verringert; die aktuellen Nachweise füge ich bei und bitte um Neuberechnung des Beitrags.

Mit freundlichen Grüßen
{name}
{address}`,
  fresh: `Ausländerbehörde Berlin
Kundennummer: A-2026-44219

Betreff: Nachreichung der fehlenden Unterlagen

Sehr geehrte Damen und Herren,

anbei reiche ich die fehlenden Unterlagen zu meinem Antrag fristgerecht nach: aktuelle Immatrikulationsbescheinigung, Nachweis der Krankenversicherung sowie den Finanzierungsnachweis (Sperrkonto).

Ich bitte um Fortführung der Bearbeitung.

Mit freundlichen Grüßen
{name}
{address}`,
};

/** Canned legal knowledge for the mocked /rag/search endpoint. */
const RAG_CORPUS = [
  {
    text: "§ 81 Abs. 4 AufenthG — Beantragung des Aufenthaltstitels. Wird der Antrag auf Verlängerung rechtzeitig gestellt, gilt der bisherige Titel bis zur Entscheidung als fortbestehend.",
    metadata: { law: "AufenthG", section: "§ 81 Abs. 4", institution: "Ausländerbehörde Berlin" },
  },
  {
    text: "§ 82 AufenthG — Mitwirkung des Ausländers. Fehlende Unterlagen sind innerhalb der gesetzten Frist nachzureichen, sonst kann der Antrag abgelehnt werden.",
    metadata: { law: "AufenthG", section: "§ 82", institution: "Ausländerbehörde Berlin" },
  },
  {
    text: "§ 4 RBStV — Befreiung von der Beitragspflicht. Empfänger von BAföG-Leistungen können auf Antrag von der Rundfunkbeitragspflicht befreit werden.",
    metadata: { law: "RBStV", section: "§ 4", institution: "Beitragsservice ARD ZDF Deutschlandradio" },
  },
  {
    text: "§ 347 AO — Einspruch. Gegen einen Steuerbescheid ist der Einspruch statthaft; er ist innerhalb eines Monats nach Bekanntgabe schriftlich einzulegen.",
    metadata: { law: "AO", section: "§ 347", institution: "Finanzamt Hamburg-Mitte" },
  },
  {
    text: "§ 67 OWiG — Einspruch gegen den Bußgeldbescheid. Der Betroffene kann innerhalb von zwei Wochen nach Zustellung Einspruch einlegen.",
    metadata: { law: "OWiG", section: "§ 67", institution: "Bußgeldstelle Berlin" },
  },
];

export function ragHits(query: string, institution?: string) {
  const q = query.toLowerCase();
  const scored = RAG_CORPUS.map((c) => {
    let score = 0.4;
    if (institution && c.metadata.institution === institution) score += 0.4;
    if (c.text.toLowerCase().split(/\W+/).some((w) => w.length > 4 && q.includes(w)))
      score += 0.2;
    return { ...c, score: Math.min(0.99, score) };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 4);
}

/** A fresh "extraction" returned by a mocked upload (POST /letters). */
export function freshUploadLetter(id: string): Letter {
  const r = risk(0.45, 1.0, 1.0, 0.0);
  return {
    id,
    institution: "Ausländerbehörde Berlin",
    document_type: "Aufforderung zur Nachreichung",
    category: "immigration",
    summary_en:
      "The immigration office is missing documents from your residence-permit file and wants them within 14 days.",
    extraction_warnings: [],
    confidence: 0.8,
    ocr_text:
      "Ausländerbehörde Berlin\nKundennummer A-2026-44219\n\nAufforderung zur Nachreichung\n\nBitte reichen Sie die fehlenden Unterlagen innerhalb von 14 Tagen nach: Immatrikulationsbescheinigung, Nachweis der Krankenversicherung, Finanzierungsnachweis.",
    actions: [
      {
        id: aid(),
        title: "Submit the missing documents within 14 days",
        description: "Your application is on hold until these arrive.",
        deadline: date(14),
        deadline_confidence: 0.88,
        deadline_source: "explicit",
        severity: "critical",
        risk_score: r.score,
        risk: r,
        status: "open",
        reply_needed: true,
        steps: [
          "Current enrolment certificate",
          "Proof of health insurance",
          "Blocked-account statement",
        ],
        evidence_span:
          "Bitte reichen Sie die fehlenden Unterlagen innerhalb von 14 Tagen nach.",
      },
    ],
  };
}
