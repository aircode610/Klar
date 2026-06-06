import type { Letter } from "@/types";

/**
 * Mock data shaped exactly like the FastAPI backend's LetterResponse, so the
 * prototype runs against the real contract. Obligation-centric: each letter
 * carries structured actions with deadlines, severity, server-style risk score,
 * steps, and the German evidence span each action came from.
 */

const DAY = 86_400_000;

/** YYYY-MM-DD, N days from today. */
function date(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * DAY).toISOString().slice(0, 10);
}

let counter = 1;
const aid = () => `act_${counter++}`;

export function seedLetters(): Letter[] {
  return [
    {
      id: "ltr_strafzettel",
      institution: "Bußgeldstelle Berlin",
      document_type: "Bußgeldbescheid",
      category: "legal_debt",
      summary_en:
        "A €60 parking fine. The window to object has already passed by two days — act now to limit the cost.",
      extraction_warnings: ["Objection deadline appears to have passed."],
      actions: [
        {
          id: aid(),
          title: "Pay the €60 fine or file an objection",
          description:
            "The two-week objection window has closed. Paying now avoids reminder fees and enforcement.",
          deadline: date(-2),
          severity: "high",
          risk_score: 82,
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
      actions: [
        {
          id: aid(),
          title: "Pay €110.40 or apply for an exemption",
          description:
            "Students on BAföG can be exempted from the Rundfunkbeitrag.",
          deadline: date(3),
          severity: "medium",
          risk_score: 58,
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
      actions: [
        {
          id: aid(),
          title: "Submit rent certificate, bank statements and proof of earnings",
          description: "Required to continue processing your benefits.",
          deadline: date(6),
          severity: "high",
          risk_score: 71,
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
      extraction_warnings: [],
      actions: [
        {
          id: aid(),
          title: "Attend the appointment with the full document set",
          description:
            "Missing this risks a gap in your legal residence status.",
          deadline: date(9),
          severity: "critical",
          risk_score: 93,
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
      actions: [
        {
          id: aid(),
          title: "Pay €412 or file an objection (Einspruch)",
          deadline: date(14),
          severity: "medium",
          risk_score: 49,
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
      actions: [
        {
          id: aid(),
          title: "Accept the new contribution or object with income proof",
          deadline: date(21),
          severity: "low",
          risk_score: 34,
          status: "open",
          reply_needed: false,
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
      actions: [
        {
          id: aid(),
          title: "Save a copy for your records",
          deadline: null,
          severity: "low",
          risk_score: 8,
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
  return {
    id,
    institution: "Ausländerbehörde Berlin",
    document_type: "Aufforderung zur Nachreichung",
    category: "immigration",
    summary_en:
      "The immigration office is missing documents from your residence-permit file and wants them within 14 days.",
    extraction_warnings: [],
    actions: [
      {
        id: aid(),
        title: "Submit the missing documents within 14 days",
        description:
          "Your application is on hold until these arrive.",
        deadline: date(14),
        severity: "critical",
        risk_score: 88,
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
