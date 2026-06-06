"""Seed corpus: German institutions + common bureaucratic phrasing.

This is the knowledge layer the extraction prompt is augmented with. Each entry
is a small fact about an institution or a recurring German bureaucratic phrase
that helps Qwen ground its extraction (institution name, deadline phrasing,
consequence severity).

`metadata.category` matches the DocumentCategory enum exactly so RAG can be
filtered to category-relevant context per call.
"""

from typing import Any

SEED_DOCS: list[dict[str, Any]] = [
    # --- immigration ---
    {
        "id": "inst-auslaenderbehoerde",
        "text": (
            "Die Ausländerbehörde issues residence permit (Aufenthaltstitel), visa renewal, "
            "and Fiktionsbescheinigung documents. Missing a deadline can result in loss of "
            "residence status. Typical reply window: 14 days. Highest-stakes institution for "
            "international students."
        ),
        "metadata": {
            "institution": "Ausländerbehörde",
            "category": "immigration",
            "risk_weight": 1.0,
        },
    },
    # --- health_insurance ---
    {
        "id": "inst-aok",
        "text": (
            "AOK is a statutory health insurance (gesetzliche Krankenversicherung). Common "
            "letters: Beitragsrechnung (premium invoice), Mahnung (payment reminder), "
            "Bescheinigung der Mitgliedschaft. Unpaid premiums lead to retroactive fees and "
            "potential loss of insurance coverage."
        ),
        "metadata": {
            "institution": "AOK",
            "category": "health_insurance",
            "risk_weight": 0.85,
        },
    },
    {
        "id": "inst-tk",
        "text": (
            "Techniker Krankenkasse (TK) is a statutory health insurance. Document types "
            "similar to AOK: Beitragsrechnung, Mahnung, Mitgliedsbescheinigung. Common for "
            "students and white-collar workers in Germany."
        ),
        "metadata": {
            "institution": "TK",
            "category": "health_insurance",
            "risk_weight": 0.85,
        },
    },
    {
        "id": "inst-barmer-dak",
        "text": (
            "BARMER and DAK-Gesundheit are large statutory health insurers (gesetzliche "
            "Krankenkassen). Similar document patterns to AOK and TK. Private alternatives "
            "include Debeka, Allianz Private Krankenversicherung, and HanseMerkur — these "
            "send Beitragsanpassungen and Rechnungen for out-of-pocket reimbursement."
        ),
        "metadata": {
            "institution": "BARMER/DAK/Debeka",
            "category": "health_insurance",
            "risk_weight": 0.85,
        },
    },
    # --- tax ---
    {
        "id": "inst-finanzamt",
        "text": (
            "Das Finanzamt is the tax authority. Common documents: Steuerbescheid (tax "
            "assessment), Mahnung wegen ausstehender Steuern, Aufforderung zur Abgabe der "
            "Steuererklärung. Deadlines often phrased as 'innerhalb eines Monats nach "
            "Bekanntgabe'. Einspruch (objection) must be filed within one month."
        ),
        "metadata": {
            "institution": "Finanzamt",
            "category": "tax",
            "risk_weight": 0.90,
        },
    },
    # --- education ---
    {
        "id": "inst-universitaet",
        "text": (
            "Universität / Hochschule sends Immatrikulationsbescheinigung, "
            "Rückmeldungsaufforderung, Exmatrikulationsbescheid, Prüfungsbescheinigung. "
            "Missing the Rückmeldung deadline triggers automatic Exmatrikulation. "
            "Re-enrollment fee window typically expires end of February or end of August."
        ),
        "metadata": {
            "institution": "Universität",
            "category": "education",
            "risk_weight": 0.80,
        },
    },
    {
        "id": "inst-studentenwerk-bafoeg",
        "text": (
            "Studentenwerk and the BAföG-Amt handle student financial aid, dormitory "
            "contracts, and meal-plan billing. BAföG letters include Bewilligungsbescheid, "
            "Aufforderung zur Mitwirkung, and Rückforderungsbescheid. Reply windows are "
            "often 4 weeks. Failure to comply can suspend BAföG payments."
        ),
        "metadata": {
            "institution": "Studentenwerk",
            "category": "education",
            "risk_weight": 0.75,
        },
    },
    # --- banking ---
    {
        "id": "inst-bank",
        "text": (
            "Banks (Sparkasse, Deutsche Bank, N26, Commerzbank, ING, DKB) send Kontoauszüge, "
            "Vertragsänderungen, Kreditkartenabrechnungen, and Kreditverträge. Missed loan "
            "or credit obligations affect SCHUFA score. SCHUFA itself sends Auskünfte "
            "directly to consumers on request."
        ),
        "metadata": {
            "institution": "Bank",
            "category": "banking",
            "risk_weight": 0.70,
        },
    },
    # --- housing ---
    {
        "id": "inst-vermieter",
        "text": (
            "Vermieter / Hausverwaltung letters include Mieterhöhung, Nebenkostenabrechnung, "
            "Mahnung wegen Mietrückstand, ordentliche Kündigung, fristlose Kündigung. "
            "German tenant law gives 14-30 days to respond to most claims. Two months of "
            "Mietrückstand can trigger fristlose Kündigung."
        ),
        "metadata": {
            "institution": "Vermieter",
            "category": "housing",
            "risk_weight": 0.60,
        },
    },
    # --- broadcast_fee ---
    {
        "id": "inst-beitragsservice",
        "text": (
            "Beitragsservice ARD ZDF Deutschlandradio (formerly GEZ) collects the "
            "Rundfunkbeitrag — the mandatory broadcasting fee of €18.36 per household per "
            "month. Triggered automatically by Anmeldung at any new address. Letters: "
            "Festsetzungsbescheid, Mahnung. Non-payment escalates to Gerichtsvollzieher."
        ),
        "metadata": {
            "institution": "Beitragsservice",
            "category": "broadcast_fee",
            "risk_weight": 0.55,
        },
    },
    # --- other_insurance ---
    {
        "id": "inst-private-insurance",
        "text": (
            "Private insurers (Allianz, HUK-COBURG, HUK24, R+V, ADAC, ERGO) cover "
            "Haftpflicht (personal liability), Hausratversicherung, Kfz-Versicherung, "
            "Lebensversicherung, Reiseversicherung, Berufsunfähigkeit. Letters: "
            "Beitragsanpassung, Vertragsverlängerung, Schadenmeldung, "
            "Kündigungsbestätigung. Contracts typically auto-renew yearly unless cancelled "
            "with 3 months notice."
        ),
        "metadata": {
            "institution": "Versicherung (privat)",
            "category": "other_insurance",
            "risk_weight": 0.50,
        },
    },
    # --- utilities ---
    {
        "id": "inst-utilities-energy",
        "text": (
            "Stadtwerke and energy providers (Vattenfall, E.ON, EnBW, Stromio, "
            "Hamburg Energie) send Jahresabrechnung (annual reconciliation), "
            "Abschlagserhöhung (monthly installment increase), Vertragswechsel, Mahnung. "
            "Non-payment can result in Stromsperre / Gassperre (cutoff)."
        ),
        "metadata": {
            "institution": "Stadtwerke/Energie",
            "category": "utilities",
            "risk_weight": 0.50,
        },
    },
    {
        "id": "inst-utilities-telecom",
        "text": (
            "Telecom providers (Telekom, Vodafone, O2, 1&1, Congstar) send Mobilfunk- and "
            "DSL-Verträge, monatliche Rechnungen, Vertragsverlängerung, Mahnung. "
            "Mobilfunkverträge auto-renew yearly with a 3-month Kündigungsfrist unless "
            "cancelled. Mahnungen can quickly escalate to Inkasso."
        ),
        "metadata": {
            "institution": "Telekom/Mobilfunk",
            "category": "utilities",
            "risk_weight": 0.50,
        },
    },
    # --- employment ---
    {
        "id": "inst-arbeitgeber",
        "text": (
            "Arbeitgeber / HR send Arbeitsvertrag, monatliche Lohn- or Gehaltsabrechnung, "
            "Lohnsteuerbescheinigung (annual), Zwischenzeugnis, Arbeitszeugnis bei "
            "Austritt, ordentliche Kündigung. Working students receive Werkstudentenverträge. "
            "Steuerklasse-Wechsel must be requested through Finanzamt."
        ),
        "metadata": {
            "institution": "Arbeitgeber",
            "category": "employment",
            "risk_weight": 0.55,
        },
    },
    # --- government_benefits ---
    {
        "id": "inst-arbeitsagentur",
        "text": (
            "Bundesagentur für Arbeit / Jobcenter administer Arbeitslosengeld I (ALG I), "
            "Bürgergeld (formerly ALG II / Hartz IV), and job placement. Letters: "
            "Bewilligungsbescheid, Aufforderung zur Mitwirkung, Sanktionsbescheid, "
            "Einladung zum Termin. Missing a termin can trigger Sanktionen (benefit cuts)."
        ),
        "metadata": {
            "institution": "Bundesagentur für Arbeit",
            "category": "government_benefits",
            "risk_weight": 0.75,
        },
    },
    {
        "id": "inst-familienkasse",
        "text": (
            "Familienkasse administers Kindergeld (€250/month per child) and is part of "
            "Bundesagentur für Arbeit. Elterngeld is administered by Elterngeldstellen in "
            "each Bundesland. Wohngeld is administered by local Wohngeldstellen. Common "
            "letter: Bewilligungsbescheid, Rückforderungsbescheid, Aufforderung zur "
            "Mitwirkung. Failure to report income changes triggers Rückforderung."
        ),
        "metadata": {
            "institution": "Familienkasse",
            "category": "government_benefits",
            "risk_weight": 0.65,
        },
    },
    # --- pension ---
    {
        "id": "inst-rentenversicherung",
        "text": (
            "Deutsche Rentenversicherung (DRV) sends the yearly Renteninformation, "
            "Versicherungsverlauf (contribution history), Rentenbescheid, and "
            "Beitragsaufforderungen for self-employed individuals (Selbstständige) who opt "
            "in. Contribution gaps must be corrected within set deadlines."
        ),
        "metadata": {
            "institution": "Deutsche Rentenversicherung",
            "category": "pension",
            "risk_weight": 0.65,
        },
    },
    # --- civic ---
    {
        "id": "inst-buergeramt",
        "text": (
            "Bürgeramt / Einwohnermeldeamt / Standesamt handle Anmeldung (residence "
            "registration), Ummeldung, Personalausweis, Reisepass, Führungszeugnis, "
            "Eheschließung. Anmeldung must be completed within 14 days of moving — "
            "missing this can trigger Bußgeld up to €1,000."
        ),
        "metadata": {
            "institution": "Bürgeramt",
            "category": "civic",
            "risk_weight": 0.60,
        },
    },
    # --- legal_debt ---
    {
        "id": "inst-inkasso",
        "text": (
            "Inkasso-Dienstleister (EOS, Creditreform, Lowell, Riverty/Arvato, "
            "Coface Debitorenmanagement) collect outstanding receivables on behalf of "
            "original creditors. Letters: Forderungsanzeige, Zahlungsaufforderung, "
            "Ankündigung SCHUFA-Eintrag. Disputed claims must be answered in writing within "
            "the stated frist — silence is treated as acceptance."
        ),
        "metadata": {
            "institution": "Inkasso",
            "category": "legal_debt",
            "risk_weight": 0.80,
        },
    },
    {
        "id": "inst-gericht-mahnbescheid",
        "text": (
            "Amtsgericht / Mahngericht issues a Mahnbescheid (court-issued payment order) "
            "when a creditor files a Mahnverfahren. The debtor has 14 days to file "
            "Widerspruch. If no Widerspruch is filed, the creditor can request a "
            "Vollstreckungsbescheid (enforcement title), enabling Pfändung."
        ),
        "metadata": {
            "institution": "Amtsgericht",
            "category": "legal_debt",
            "risk_weight": 0.90,
        },
    },
    {
        "id": "inst-bussgeldstelle",
        "text": (
            "Bußgeldstellen issue Bußgeldbescheide for traffic violations (parking, "
            "speeding), Schwarzfahren on public transport, missed Anmeldung, or other "
            "administrative offenses. Einspruchsfrist is exactly 14 days from delivery — "
            "after that the Bußgeld becomes rechtskräftig."
        ),
        "metadata": {
            "institution": "Bußgeldstelle",
            "category": "legal_debt",
            "risk_weight": 0.75,
        },
    },
    # --- language / phrase patterns ---
    {
        "id": "phrase-frist-14-tage",
        "text": (
            "Common German deadline phrasing: 'innerhalb von 14 Tagen ab Zustellung dieses "
            "Schreibens' = 'within 14 days of receipt of this letter'. Counting starts from "
            "the day of receipt, not the date on the letter. If the date is uncertain, "
            "assume Zustellung = postmark + 3 days."
        ),
        "metadata": {"category": "language", "phrase_type": "deadline"},
    },
    {
        "id": "phrase-frist-monat",
        "text": (
            "'Innerhalb eines Monats nach Bekanntgabe' = within one month after notification. "
            "Standard Einspruchsfrist for most German official decisions (Bescheide), "
            "including Steuerbescheid, Sozialleistungsbescheid, Bewilligungsbescheid."
        ),
        "metadata": {"category": "language", "phrase_type": "deadline"},
    },
    {
        "id": "phrase-mahnung",
        "text": (
            "'Mahnung' = formal payment reminder. First Mahnung is typically informational. "
            "Second Mahnung adds a fee (€5-€15). Third Mahnung threatens Inkasso (debt "
            "collection) and SCHUFA reporting. Respond before the next escalation step."
        ),
        "metadata": {"category": "language", "phrase_type": "demand"},
    },
    {
        "id": "phrase-rueckmeldung",
        "text": (
            "'Rückmeldung' at a German university = re-enrollment for the next semester. "
            "Requires payment of Semesterbeitrag by deadline. Missing the Rückmeldung = "
            "automatic Exmatrikulation."
        ),
        "metadata": {"category": "language", "phrase_type": "process"},
    },
    {
        "id": "phrase-widerspruch",
        "text": (
            "'Widerspruch' = formal written objection against an official Bescheid. "
            "Standard frist is one month from receipt. Must be filed in writing, in German, "
            "and reach the issuing authority before the deadline. Email is usually NOT "
            "sufficient — written letter or qualified electronic signature required."
        ),
        "metadata": {"category": "language", "phrase_type": "process"},
    },
    {
        "id": "phrase-kuendigungsfrist",
        "text": (
            "Most German contracts (gym memberships, mobile/DSL, insurance) auto-renew "
            "yearly unless cancelled with 3 months written notice before the renewal date "
            "(Kündigungsfrist). Since 2022, consumer contracts signed online can be "
            "cancelled with 1 month notice instead of 3."
        ),
        "metadata": {"category": "language", "phrase_type": "process"},
    },
]


def seed_corpus(collection) -> None:
    """Upsert all SEED_DOCS into the given Chroma collection."""
    ids = [d["id"] for d in SEED_DOCS]
    docs = [d["text"] for d in SEED_DOCS]
    metas = [d["metadata"] for d in SEED_DOCS]
    collection.upsert(ids=ids, documents=docs, metadatas=metas)
