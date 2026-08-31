"""Seed the local dev DB with a demo user + realistic processed letters.

Run from backend/:  ../.venv/bin/python ../scripts/seed_demo.py
"""

from datetime import date

from sqlmodel import Session as DBSession, SQLModel, create_engine, select

from app.auth.utils import hash_password
from app.config import settings
from app.models import (
    ActionItem,
    ActionStatus,
    DeadlineSource,
    DocumentCategory,
    Letter,
    LetterStatus,
    RiskScore,
    Severity,
    User,
)

engine = create_engine(settings.database_url)
SQLModel.metadata.create_all(engine)

with DBSession(engine) as db:
    user = db.exec(select(User).where(User.email == "demo@klar.app")).first()
    if not user:
        user = User(email="demo@klar.app", password_hash=hash_password("klar-demo-2026"), language="en")
        db.add(user)
        db.commit()
        db.refresh(user)

    # wipe previous demo letters for idempotency
    for letter in db.exec(select(Letter).where(Letter.user_id == user.id)).all():
        for a in db.exec(select(ActionItem).where(ActionItem.letter_id == letter.id)).all():
            for r in db.exec(select(RiskScore).where(RiskScore.action_item_id == a.id)).all():
                db.delete(r)
            db.delete(a)
        db.delete(letter)
    db.commit()

    def add_letter(letter: Letter, actions: list[tuple[ActionItem, int, str]]):
        db.add(letter)
        db.commit()
        db.refresh(letter)
        for action, score, why in actions:
            action.letter_id = letter.id
            db.add(action)
            db.commit()
            db.refresh(action)
            db.add(RiskScore(action_item_id=action.id, score=score, explanation=why,
                             deadline_proximity_pts=round(score / 5 * 0.9, 2),
                             institution_weight=0.8,
                             severity_pts=round(score / 5 * 0.7, 2)))
        db.commit()

    # 1 — Immigration, urgent
    add_letter(
        Letter(
            user_id=user.id,
            original_file="uploads/immigration.png",
            letter_type="Mitwirkungsaufforderung",
            institution="Ausländerbehörde Berlin",
            document_type="Request for documents — residence permit extension",
            category=DocumentCategory.IMMIGRATION,
            summary="The immigration office is processing your residence permit extension. They need two documents from you before 12 September 2026. Your permit stays valid while they decide (Fiktionswirkung) — but only if you respond in time.",
            language="en",
            ocr_text="Sehr geehrte Damen und Herren, im Rahmen des Verfahrens zur Verlängerung Ihrer Aufenthaltserlaubnis gemäß § 16b AufenthG werden Sie gebeten, folgende Unterlagen bis zum 12.09.2026 nachzureichen: 1. Nachweis über bestehenden Krankenversicherungsschutz, 2. Aktuelle Immatrikulationsbescheinigung. Bei nicht fristgerechter Vorlage kann der Antrag nach Aktenlage entschieden werden.",
            ocr_confidence=0.97,
            confidence=0.94,
            explanation="This is a cooperation request (Mitwirkungsaufforderung) under § 82 AufenthG. The office cannot finish your extension without proof of health insurance and a current enrollment certificate. 'Entscheidung nach Aktenlage' means they may reject the application based on the incomplete file if you miss the deadline.",
            response_draft="Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihr Schreiben vom 24.08.2026, Geschäftszeichen 442-A/2026. Anbei übersende ich Ihnen fristgerecht die angeforderten Unterlagen: den Nachweis meines Krankenversicherungsschutzes bei der Techniker Krankenkasse sowie meine aktuelle Immatrikulationsbescheinigung der TU Berlin für das Wintersemester 2026/27.\n\nMit freundlichen Grüßen",
            checklist=["Proof of health insurance (Versicherungsbescheinigung)", "Current enrollment certificate (Immatrikulationsbescheinigung)", "Copy of passport photo page", "Reference number 442-A/2026 on every page"],
            citations=[{"ref": "§ 16b AufenthG", "title": "Studium"}, {"ref": "§ 82 Abs. 1 AufenthG", "title": "Mitwirkung des Ausländers"}, {"ref": "§ 81 Abs. 4 AufenthG", "title": "Fiktionswirkung"}],
            consequence="Application may be decided on the incomplete file — likely rejection of the extension.",
            risk_reason="Hard deadline in 12 days; missing it risks the residence permit itself.",
            risk_score=4,
            deadline_date=date(2026, 9, 12),
            status=LetterStatus.COMPLETED,
        ),
        [
            (ActionItem(title="Send proof of health insurance", description="Request a Versicherungsbescheinigung from TK and submit it with the reference number.", steps=["Log in to the TK app and download the certificate", "Add reference 442-A/2026", "Upload via the Ausländerbehörde portal or send by post"], deadline=date(2026, 9, 12), deadline_confidence=0.98, deadline_source=DeadlineSource.EXPLICIT, severity=Severity.CRITICAL, reply_needed=True, evidence_span="Nachweis über bestehenden Krankenversicherungsschutz … bis zum 12.09.2026"), 4, "Explicit deadline 12 days away; consequence touches residence status."),
            (ActionItem(title="Send current enrollment certificate", description="Download the Immatrikulationsbescheinigung for winter semester 2026/27.", steps=["Download from the university portal", "Attach to the same response letter"], deadline=date(2026, 9, 12), deadline_confidence=0.98, deadline_source=DeadlineSource.EXPLICIT, severity=Severity.CRITICAL, reply_needed=True, evidence_span="Aktuelle Immatrikulationsbescheinigung"), 4, "Same explicit deadline; both documents must arrive together."),
        ],
    )

    # 2 — Health insurance
    add_letter(
        Letter(
            user_id=user.id,
            original_file="uploads/insurance-test.jpg",
            letter_type="Beitragsrückstand",
            institution="Techniker Krankenkasse",
            document_type="Outstanding contribution notice",
            category=DocumentCategory.HEALTH_INSURANCE,
            summary="TK says two monthly contributions (€ 241.20) are unpaid. Pay by 22 September 2026 or coverage can be downgraded to emergency-only (Ruhen der Leistungen).",
            language="en",
            ocr_text="Sehr geehrte/r Versicherte/r, für die Monate Juni und Juli 2026 besteht ein Beitragsrückstand in Höhe von 241,20 EUR. Wir bitten um Ausgleich bis zum 22.09.2026. Bei Nichtzahlung ruhen Ihre Leistungsansprüche gemäß § 16 Abs. 3a SGB V.",
            ocr_confidence=0.96,
            confidence=0.92,
            explanation="Two months of student health-insurance contributions are outstanding. Under § 16 Abs. 3a SGB V, continued non-payment lets the insurer suspend benefits except emergency and pregnancy care. Payment (or a payment plan) before the deadline fully prevents this.",
            response_draft="Sehr geehrte Damen und Herren,\n\nhiermit bestätige ich den Erhalt Ihrer Zahlungserinnerung vom 20.08.2026. Den offenen Betrag in Höhe von 241,20 EUR habe ich heute unter Angabe meiner Versicherungsnummer überwiesen. Ich bitte um eine kurze Bestätigung des Zahlungseingangs.\n\nMit freundlichen Grüßen",
            checklist=["Transfer € 241.20 with your insurance number as reference", "Keep the transfer receipt", "Optional: request a payment plan (Ratenzahlung) if needed"],
            citations=[{"ref": "§ 16 Abs. 3a SGB V", "title": "Ruhen des Leistungsanspruchs"}, {"ref": "§ 24 SGB IV", "title": "Säumniszuschlag"}],
            consequence="Benefits suspended to emergency-only care plus 1% monthly late surcharge.",
            risk_reason="Money deadline with a real but reversible consequence.",
            risk_score=3,
            deadline_date=date(2026, 9, 22),
            status=LetterStatus.COMPLETED,
        ),
        [
            (ActionItem(title="Pay outstanding € 241.20 to TK", description="Contributions for June and July 2026.", steps=["Transfer with insurance number as payment reference", "Keep the receipt"], deadline=date(2026, 9, 22), deadline_confidence=0.97, deadline_source=DeadlineSource.EXPLICIT, severity=Severity.HIGH, reply_needed=False, amount_due_eur=241.20, evidence_span="Beitragsrückstand in Höhe von 241,20 EUR … bis zum 22.09.2026"), 3, "Explicit amount and date; suspension of benefits if ignored."),
        ],
    )

    # 3 — Tax
    add_letter(
        Letter(
            user_id=user.id,
            original_file="uploads/tax.png",
            letter_type="Erinnerung zur Abgabe",
            institution="Finanzamt Berlin Mitte/Tiergarten",
            document_type="Reminder — 2025 income tax return",
            category=DocumentCategory.TAX,
            summary="The tax office reminds you to file your 2025 income tax return by 15 October 2026. Late filing can trigger an automatic surcharge (Verspätungszuschlag).",
            language="en",
            ocr_text="Sehr geehrte/r Steuerpflichtige/r, nach unseren Unterlagen wurde die Einkommensteuererklärung für das Jahr 2025 bisher nicht eingereicht. Wir bitten um Abgabe bis zum 15.10.2026. Bei verspäteter Abgabe kann ein Verspätungszuschlag nach § 152 AO festgesetzt werden.",
            ocr_confidence=0.95,
            confidence=0.91,
            explanation="A routine but binding filing reminder. § 152 AO sets the late surcharge at 0.25% of assessed tax per month (minimum € 25/month). Filing via ELSTER before 15 October avoids it entirely; as a student with side income you may even be owed a refund.",
            response_draft="Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Erinnerung vom 18.08.2026. Ich werde die Einkommensteuererklärung für 2025 fristgerecht über ELSTER einreichen. Sollten darüber hinaus Unterlagen benötigt werden, erreichen Sie mich unter der oben genannten Anschrift.\n\nMit freundlichen Grüßen",
            checklist=["Gather Lohnsteuerbescheinigung 2025", "Collect study-cost receipts (laptop, semester fee, transit)", "File via ELSTER before 15 Oct 2026"],
            citations=[{"ref": "§ 149 AO", "title": "Abgabefrist"}, {"ref": "§ 152 AO", "title": "Verspätungszuschlag"}],
            consequence="Automatic late surcharge of at least € 25 per started month.",
            risk_reason="Six weeks of lead time; financial-only consequence.",
            risk_score=2,
            deadline_date=date(2026, 10, 15),
            status=LetterStatus.COMPLETED,
        ),
        [
            (ActionItem(title="File 2025 tax return via ELSTER", description="Deadline 15 October 2026 — surcharge applies after.", steps=["Collect Lohnsteuerbescheinigung", "Enter study costs as Werbungskosten", "Submit via ELSTER"], deadline=date(2026, 10, 15), deadline_confidence=0.96, deadline_source=DeadlineSource.EXPLICIT, severity=Severity.MEDIUM, reply_needed=False, evidence_span="Abgabe bis zum 15.10.2026"), 2, "Comfortable lead time, bounded financial downside."),
        ],
    )

    # 4 — Broadcast fee, handled
    add_letter(
        Letter(
            user_id=user.id,
            original_file="uploads/6yk476hrnu1d1.jpeg",
            letter_type="Zahlungsaufforderung",
            institution="ARD ZDF Deutschlandradio Beitragsservice",
            document_type="Broadcast fee — payment request",
            category=DocumentCategory.BROADCAST_FEE,
            summary="Quarterly broadcast fee of € 55.08 was due. You paid it on 26 August — this letter is settled.",
            language="en",
            ocr_text="Zahlungsaufforderung: Für den Zeitraum 07/2026 bis 09/2026 ist ein Rundfunkbeitrag in Höhe von 55,08 EUR fällig.",
            ocr_confidence=0.98,
            confidence=0.95,
            explanation="Standard quarterly Rundfunkbeitrag under § 2 RBStV — one fee per household. If your flatmate already pays for the apartment, you can deregister instead.",
            response_draft="Sehr geehrte Damen und Herren,\n\nder angeforderte Rundfunkbeitrag in Höhe von 55,08 EUR wurde am 26.08.2026 unter Angabe der Beitragsnummer überwiesen.\n\nMit freundlichen Grüßen",
            checklist=["Payment done — keep the receipt"],
            citations=[{"ref": "§ 2 RBStV", "title": "Rundfunkbeitrag im privaten Bereich"}],
            consequence="None — settled.",
            risk_reason="Paid before the due date.",
            risk_score=1,
            deadline_date=date(2026, 8, 28),
            status=LetterStatus.COMPLETED,
        ),
        [
            (ActionItem(title="Pay quarterly broadcast fee € 55.08", description="Q3 2026 Rundfunkbeitrag.", steps=["Transfer with Beitragsnummer"], deadline=date(2026, 8, 28), deadline_confidence=0.99, deadline_source=DeadlineSource.EXPLICIT, severity=Severity.LOW, reply_needed=False, status=ActionStatus.DONE, amount_due_eur=55.08, evidence_span="55,08 EUR fällig"), 1, "Paid; kept for the archive."),
        ],
    )

print("seeded demo@klar.app with 4 letters")
