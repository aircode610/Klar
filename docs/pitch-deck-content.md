# Klar — Pitch Deck Content

> Pre-Seed | June 2026

**Tagline:** Your AI caseworker for German bureaucracy. Decode. Draft. Done.

---

## Slide 1 — Problem + Customer

### A German letter you can't read. A deadline you can't miss.

**Key numbers:**

| Metric | Value |
|--------|-------|
| International students in Germany | 402,000 (WS 2024/25, +6% YoY) |
| EU Blue Card holders | 113,500 (end-2023, BAMF) |
| Avg. wait for a residence permit (Berlin) | 3-6 months |

**The pain:**

> Miss a deadline from the Auslanderbehorde and you lose your legal right to stay in Germany. Today, decoding one letter costs **150+ euros at a lawyer** — or a panicked Reddit post at midnight.

**Who has this problem:**
- International students (402K enrolled, 116K new per year)
- EU Blue Card holders (113K, with 56K new issuances in 2024 alone — 72% of the entire EU)
- Chancenkarte/Opportunity Card arrivals (11,497 visas issued through June 2025)
- Foreign nationals overall: 14 million registered in Germany

**What they do today:**
- Pay a lawyer 150 euros for 20 minutes to explain one letter
- Panic-post on Reddit/Facebook expat groups at midnight
- Ask German friends (social debt, delays, unreliable)
- Stare at German forms for hours, Googling field by field
- Ignore it and hope for the best (worst case: deportation proceedings)

**Why it's painful enough to pay:**
- 104 distinct legal bases for national visas (IW, Nov 2025)
- Appointment waits of 3-6 months; suing for delays costs 700-3,000 euros
- A wrongly filled form means rejection and starting over

---

## Slide 2 — Solution + Product

### Upload a letter. Get the full answer.

**Four capabilities — no competitor does all four together:**

| Feature | What it does |
|---------|-------------|
| Decode & Explain | OCR reads the letter, classifies it, flags the deadline and risk in your language |
| Draft the Response | Generates a ready-to-send reply in Behordendeutsch with document checklist |
| Fill Your Forms | Detects form fields, asks simple questions, returns a filled form you can print |
| Cite the Law | RAG over 13 German laws & 1,488 paragraphs — real citations, zero hallucination |

**The pipeline:**

```
Upload letter -> OCR + Classify -> Explain + Cite -> Draft reply -> Fill forms
```

**End-to-end in 27 seconds.**

**Tech stack (not a wrapper):**
- Qwen-VL for document OCR (vision model, not generic text)
- Qwen-VL for form field detection and filled-form image generation
- LangGraph ReAct agent with tool calling (web search for current rules)
- RAG over 13 German legal texts with cosine similarity retrieval (ChromaDB)
- Structured output via Pydantic schemas
- Anti-hallucination: model can ONLY cite paragraphs present in retrieved context

---

## Slide 3 — Why Now

### Three shifts opened this window.

**1. Vision LLMs finally work**
- Qwen-VL hits 96.4% on DocVQA (human baseline: 98.1%)
- 88.8% on OCRBench
- Faded stamps, dense legal German, handwritten notes — impossible 2 years ago

**2. Germany's digitization stalled**
- OZG (2017): promised 6,000 services online by 2022
- Reality: only 115 prioritized services are nationwide-digital
- OZG 2.0 (July 2024) dropped the binding deadline entirely
- The government won't fix this soon — the gap is Klar's market

**3. Customer base is surging**
- Skilled Immigration Act reforms fully in force (June 2024): lower Blue Card thresholds, expanded shortage-occupation list
- Chancenkarte launched June 2024: 11,497 visas issued in first year
- Germany issued 56,252 Blue Cards in 2024 — 72% of the entire EU total
- Western Balkans quota doubled to 50K/yr; India skilled-worker quota raised from 20K to 90K
- Citizenship reform (June 2024): dual citizenship allowed, naturalization after 5 years

**4. Inference costs collapsed**
- What cost $100/user in 2023 costs $2 today
- A consumer-priced product at 7.99/mo is viable for the first time

---

## Slide 4 — Market + Competition

### 700K high-need users. Zero funded competitors.

**Bottom-up market sizing:**

| Level | Population | Value |
|-------|-----------|-------|
| **TAM** — All foreign nationals in Germany | 14M x 7.99/mo x 12 | ~1.35B euros/yr |
| **SAM** — Beachhead (students + Blue Card + Chancenkarte) | ~700-750K high-need users | ~67M euros/yr |
| **SOM** — 3-year target (2-4% conversion) | ~22K paying users | ~2.1M ARR |

*Bottom-up: 22K paying users x 7.99/mo x 12*

**Competitive matrix:**

| Competitor | Decode | Draft reply | Fill forms | Cite law | Funded |
|-----------|--------|------------|------------|----------|--------|
| Admina | Yes | No | No | No | No |
| Papeer | Yes | Yes | No | No | Studio |
| Ridocu | Yes | Yes | Yes | No | 1 angel |
| SmartBurokratie | Partial | No | No | Yes | No |
| **Klar** | **Yes** | **Yes** | **Yes** | **Yes** | **—** |

**Key competitive findings:**
- No direct competitor has raised institutional VC
- Ridocu (only funded competitor via single angel cheque) has pivoted to B2B — vacating the consumer market
- Papeer (most feature-complete rival) has negligible traction ("not enough ratings" on App Store)
- SmartBurokratie has 3 ratings total
- The quadrant Klar occupies — narrow + acts for you — is empty

**Adjacent players (not competitors):**
- DeepL: translation only, no explanation/deadlines/drafting/forms
- Fintiba/Expatrio: blocked-account providers, proof of willingness-to-pay
- Handbook Germany, IamExpat: content portals, not action tools

---

## Slide 5 — Business Model + Evidence

### Replace the 150 euro lawyer with 8 euros/month.

**Pricing:**

| | Lawyer | Klar |
|---|--------|------|
| Cost | 150 euros per letter (20 min) | 7.99 euros/month |
| Scope | One letter explained | Unlimited letters + forms + follow-up chat |
| Speed | Appointment in days/weeks | 27 seconds |

**Willingness-to-pay evidence (these users already pay):**

| Existing cost | Amount |
|--------------|--------|
| Blocked-account deposit | 11,904 euros/yr (992/mo) |
| Fintiba/Expatrio setup | 89-159 euros |
| Health insurance | 95-146 euros/mo |
| Lawyer first consult | 190 euros (oral) / 250 euros (written) |
| Lawyer hourly rate | 220-300 euros/hr |
| Visa appeal | 2,000-4,000 euros |

*7.99/mo is trivial against the cost of a missed-deadline visa problem.*

**Freemium conversion benchmark:** 3-5% is "good" for self-serve freemium (OpenView/Lenny's Newsletter, 1,000+ product study). Plan on 2-4%.

**The funnel:**
1. First letter free (demonstrate value)
2. 7.99 euros/month unlimited
3. B2B2C upsell (universities, employers, insurers)

**Unit economics target:**
- LTV: ~50-96 euros (7.99/mo x ~12-month student lifecycle)
- CAC: <20 euros (organic community + campus channels)
- LTV:CAC ratio: 3:1 or better

**Additional revenue paths:**
- B2B2C: university international offices, Studentenwerk, employer relocation packages, Krankenkassen
- Per-document / pay-as-you-go for one-off users

---

## Slide 6 — Go-to-Market

### Munich campus to every German university.

**Step 1 — Munich beachhead: TUM & LMU**
- 15,000 international students
- We are the customer — in the WhatsApp groups, at orientation week, in ESN chapters
- Target: 50 users in month 1

**Step 2 — Expat communities & origin networks**
- India is #1 source country (59,000 students, +20% YoY)
- Facebook expat groups, r/germany, Telegram channels
- Zero-CAC organic channels
- Target: 500 users by month 3

**Step 3 — B2B2C in parallel**
- University international offices and Studentenwerk
- Employer relocation packages
- One signed university pilot is the most fundable proof point
- Ridocu's B2B pivot independently validates this demand

**Geographic expansion:**
- Top 3 states by international students: North Rhine-Westphalia (78,500), Bavaria (61,400), Berlin (40,800)
- Origin-community targeting: Indian (59K) and Chinese (38.6K) student networks

---

## Slide 7 — Team

### We built this because we live it.

> "We are international students in Germany. We've paid the 150-euro lawyer. We've panicked over the Auslanderbehorde letter. We've stared at German forms for hours. We built Klar to fix our own problem."

**Team:**

| Role | Person | Edge |
|------|--------|------|
| CEO / Product | [Name] | International student, domain expert. Lived the immigration bureaucracy firsthand. |
| CTO / AI | [Name] | Built the full AI pipeline: OCR, ReAct agent, RAG over 13 German laws. |
| Engineering | [Name] | Full-stack. FastAPI backend, Next.js frontend, SSE streaming. |
| Engineering | [Name] | RAG pipeline, ChromaDB, legal text ingestion, response generation. |

**What we built (hackathon demo, 6 hours):**

| Component | Tech | Time |
|-----------|------|------|
| OCR | Qwen-VL-OCR | ~5s |
| Classification + Risk | LangGraph ReAct agent + Tavily + Qwen 3.7 | ~7s |
| Legal retrieval | ChromaDB RAG, 13 laws, 1,488 paragraphs | ~2s |
| Response generation | Qwen 3.7 + structured output | ~13s |
| Follow-up chat | RAG-grounded conversational assistant | Real-time |
| Form-fill | Vision model field detection + overlay | ~10s |
| **Total** | **End-to-end** | **~27s** |

**Contact:**
- Email: team@klar.app
- Website: klar.app
- Demo: demo.klar.app

---

## Legal / Compliance Notes (for investor due diligence)

**GDPR/DSGVO:** Documents contain Art. 9 special-category data. Klar runs on explicit consent, EU data residency, encryption at rest/in transit, data minimization, no training on user data without consent, deletion rights.

**RDG (Rechtsdienstleistungsgesetz):** Positioned as information/translation/drafting-assistance tool (not legal representation). Key precedent: BGH, 27 Nov 2019, VIII ZR 285/18 — RDG is "offen fur neue Berufsbilder." Prominent disclaimers, human-in-the-loop, "see a lawyer" routing for edge cases.

**EU AI Act:** Consumer document-explanation tool is "limited risk" (transparency duties only), not high-risk. Documented risk assessment, human oversight, no automated decisions on legal entitlements.
