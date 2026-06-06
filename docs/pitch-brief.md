# Klar — Pitch Brief & Market Research Input

> Feed this document to an AI for market analysis, competitive research, and pitch deck creation.

---

## One-sentence pitch

Klar reads your German official letter, tells you exactly what's required, drafts the response, fills your forms, and answers your follow-up questions — so you never need a €150 lawyer again.

## The problem (specific buyer, specific pain)

**Who:** International students and skilled workers in Germany — 450,000+ new international students enroll each year, plus ~250,000 skilled worker visa holders.

**The moment of pain:** You receive an official German letter from the Ausländerbehörde, Krankenkasse, Finanzamt, or university. It's in legal German (Behördendeutsch) you can't fully read. It has a deadline. Missing it could cost your residence permit, your health insurance, or your tax refund. You don't know what it means, what to do, or how to respond.

**The second moment of pain:** The letter includes a form. It's in German. You need to fill in fields like "Aufenthaltstitel," "Erwerbstätigkeit," "Steuer-Identifikationsnummer." You don't know what half the fields mean, let alone what to write. You stare at a blank form for an hour, terrified of writing the wrong thing.

**What they do today (the status quo we replace):**
- Pay a lawyer €150 for 20 minutes to explain one letter
- Panic-post on Reddit/Facebook expat groups and wait for unreliable advice
- Ask German friends/colleagues to translate and help fill forms (social debt, delays)
- Stare at German forms for hours, Googling field by field
- Ignore it and hope for the best (worst case: deportation proceedings)

**Why this is painful enough to pay for:** A missed Ausländerbehörde deadline isn't annoying — it can cost your legal right to stay in Germany. Permit must be applied for within 90 days; appointment waits run 4-8 weeks. And a wrongly filled form means rejection and starting over. Real panic = real demand.

## What Klar does

Upload any official German letter or form (photo, PDF, or camera capture). Klar does three things no competitor does:

### 1. Analyzes & drafts (the core pipeline)
1. **Reads it** — Qwen-VL OCR extracts every word from the scan
2. **Classifies it** — ReAct agent (LangGraph + Tavily search) identifies the letter type, sender, and urgency
3. **Scores the risk** — 1-5 scale with specific consequences ("miss this and your permit application is rejected")
4. **Explains it** — plain-language explanation in your language (English, German, Turkish, Arabic, Persian, etc.)
5. **Cites the law** — RAG pipeline retrieves actual § paragraphs from German legal texts (AufenthG, AsylG, SGB V, EStG, etc.) — no hallucinated citations
6. **Drafts the response** — ready-to-send cover letter in Behördendeutsch with document checklist

### 2. Fills your forms (form-fill assistant)
When the letter includes a form (insurance application, tax declaration, residence permit renewal), Klar:
1. **Detects the form fields** — OCR identifies every blank field and its German label
2. **Asks you the right questions** — in your language, explains what each field means and what to write
3. **Returns the original image with your answers written in** — the user gets back their exact scanned form with the fields filled in, ready to print and submit

This is the "be the caseworker" move. The user doesn't need to understand the form. They answer simple questions ("What's your insurance number?" "When did you enter Germany?"), and Klar produces a filled form they can physically hand in or mail.

### 3. AI follow-up assistant (conversational)
After the analysis, users can ask follow-up questions in a chat interface:
- "What if I can't get the documents in time?"
- "Can I extend the deadline?"
- "What's the difference between Aufenthaltserlaubnis and Niederlassungserlaubnis?"

The assistant is grounded in the same RAG legal corpus — answers cite actual § paragraphs, not hallucinated advice. It knows the context of your specific letter (the classification, deadline, and consequences are already in the conversation). This turns Klar from a one-shot tool into an ongoing advisor.

**What competitors don't do:** Every competitor (Admina, Bureaucracy Buddy, DocuPilot, mika, Ridocu) stops at "here's what it means + a to-do list." None produce the response letter. None fill your forms. None give you a grounded legal assistant that knows your specific case.

## The strategic insight (empty quadrant)

Two axes define this space:
- **Breadth:** broad (any letter, any agency) vs. narrow (one painful domain)
- **Depth:** explains (tells you what to do) vs. acts (does the work for you)

Every existing app clusters in **broad + explain-only**. The open quadrant — **narrow + acts for you** — is empty. That's our wedge.

Klar doesn't just explain. It **does the work**: drafts the response, fills the form, answers the follow-up. We start narrow (student/immigration bureaucracy) and deep (be the caseworker), then expand.

## Why now

1. **AI can finally parse Behördendeutsch reliably.** Vision-language models (Qwen-VL) read handwritten stamps, faded faxes, and dense legal German that OCR couldn't touch 2 years ago.
2. **Germany's digitalization has stalled.** Only 166 of the services under the 2017 Online Access Act were available nationwide as of Jan 2025. 16 states, 11,000+ local authorities can't coordinate. The government won't fix this soon — which is exactly why a workaround layer has room to exist.
3. **Structured legal text is now embeddable.** RAG over German law (Aufenthaltsgesetz, Asylgesetz, etc.) means we can ground every claim in actual § paragraphs — killing the hallucination fear that stops anyone trusting AI with visa matters.
4. **Vision models can now write on images.** Qwen-VL and similar models can understand form layouts and generate overlay text — making AI form-filling on physical documents feasible for the first time.

## Competitive landscape

| Competitor | What they do | What they don't do |
|---|---|---|
| **Admina** | Translate, summarize, step-by-step plan, deadline tracking, chat | Draft response, fill forms, cite law, risk score |
| **Bureaucracy Buddy / Papierkram** | "Not just a translator, we tell you what to do" + scam detection | Draft response, fill forms, legal grounding |
| **DocuPilot** | "AI digital binder for expats," Ausländerbehörde/Finanzamt terms | Draft response, fill forms, consequence engine |
| **mika, Ridocu** | Upload-and-explain core | Same — explain only, no forms, no drafts |
| **€150 lawyer** | Explains, drafts response, helps with forms | Costs €150/letter, 20 min, requires appointment |
| **Reddit/Facebook groups** | Free, fast | Unreliable, no legal grounding, no response draft, no form help |

**Our edge:** We're the only product that (a) drafts the response letter, (b) fills forms with the user's data on the original image, and (c) provides a grounded legal assistant — all backed by § citations from actual German law. We replace the €150 lawyer consult, not compete with free explain-only apps.

## The three features that differentiate

| Feature | What it does | Why it matters | What competitors have |
|---|---|---|---|
| **Response generator** | Drafts the reply in Behördendeutsch + document checklist | The user sends back a professional response, not a panicked email | Nobody does this |
| **Form-fill assistant** | Returns the scanned form with fields filled in from user's answers | The user prints and submits a correctly filled German form without understanding the fields | Nobody does this |
| **Grounded legal chat** | Follow-up Q&A citing actual § paragraphs from RAG | Turns a one-shot tool into an ongoing caseworker that knows your case | Admina has generic chat, but no RAG legal grounding |

## What we built (hackathon demo)

Full working pipeline, built from scratch on June 6:

| Component | Tech | Time |
|---|---|---|
| OCR | Qwen-VL-OCR (dedicated OCR model) | ~5s |
| Classification + Risk | LangGraph ReAct agent + Tavily search + Qwen 3.7 | ~7s |
| Legal retrieval | ChromaDB RAG over 13 German laws, 1,488 § paragraphs | ~2s |
| Response generation | Qwen 3.7 with anti-hallucination prompt + structured output | ~13s |
| Follow-up chat | RAG-grounded conversational assistant | Real-time |
| Form-fill | Vision model detects fields, collects user data, overlays answers | ~10s |
| **Total** | **End-to-end letter processing** | **~27s** |

**AI leverage (not a wrapper):**
- Qwen-VL for document OCR (vision model, not generic text)
- Qwen-VL for form field detection and filled-form image generation
- LangGraph ReAct agent with tool calling (web search for current rules)
- RAG over 13 German legal texts with cosine similarity retrieval
- RAG-grounded conversational assistant for follow-up questions
- Structured output via Pydantic schemas (no manual parsing)
- Anti-hallucination: model can ONLY cite §§ present in the retrieved context

**Stack:** Python, FastAPI, Next.js, LangGraph, Qwen (sponsor), Tavily, ChromaDB, SQLite

## Market sizing (bottom-up, not top-down)

| Segment | Count | Willingness to pay | Annual revenue potential |
|---|---|---|---|
| International students in Germany | 450,000 | €5-10/month (vs. €150/lawyer visit) | €27M-54M |
| Skilled worker visa holders | 250,000 | €10-15/month | €30M-45M |
| EU citizens in Germany (non-native) | 5M+ | €3-5/month (lower urgency) | €180M+ |

**Beachhead:** International students at 3 Munich universities. ~15,000 students, each receiving 5-10 official letters per year.

**Business model:** Freemium. First letter free (demonstrate value). €7.99/month for unlimited letters + deadline tracking + response drafts + form filling + follow-up chat. Replace the €150 lawyer consult with a €8/month subscription.

## Evidence / founder-market fit

- We are international students in Germany. We have lived this exact letter — the Ausländerbehörde document request that arrives in legal German you can't read, with a 14-day deadline you can't miss.
- We have personally paid lawyers to explain letters. We have personally panicked in Reddit threads. We have stared at German forms for hours.
- [Add: user validation quotes, waitlist numbers, or "when can I try it" messages from classmates]

## Team

| Role | Person | Edge |
|---|---|---|
| [Name] | [Role] | [What they bring — domain knowledge, technical skill, lived experience] |
| [Name] | [Role] | |
| [Name] | [Role] | |
| [Name] | [Role] | |

## Biggest risk (we name it ourselves)

**Legal liability.** We generate response letters and fill forms that people submit to government agencies. If the output is wrong, the consequence could be a missed deadline or rejected application. Our mitigation:
- Every legal claim is RAG-grounded in actual § text
- Anti-hallucination rules prevent made-up citations
- Form-fill asks the user for their data (we don't guess personal information)
- Output is clearly labeled as AI-generated assistance (not legal advice)
- Long-term: partnership with a legal review service for high-stakes submissions

## What we'd test next (Monday)

1. Send the demo to 20 classmates with real letters and forms they've received. Measure: do they trust it enough to send the response / submit the form?
2. A/B test: Klar response vs. what they'd write themselves vs. what a lawyer wrote. Have a native German speaker rate quality.
3. Test form-fill accuracy: give 10 users a real Anmeldung form. Compare Klar-filled vs. manually filled for correctness.
4. Validate pricing: would you pay €7.99/month for this? (The Mom Test: watch behavior, not compliments)

## Pitch deck mapping (7 slides)

| Slide | Content from this doc |
|---|---|
| 1. Problem + customer | "The moment of pain" — specific buyer, specific letter, specific form, specific consequence |
| 2. Solution + product | "What Klar does" — three features (analyze & draft, fill forms, AI assistant), live demo |
| 3. Why now | AI reads Behördendeutsch + Germany's stalled digitalization + RAG over law + vision models fill forms |
| 4. Market + competition | Bottom-up sizing + competitive table + empty quadrant + three differentiating features |
| 5. Business model + evidence | Freemium pricing + founder-market fit + user validation |
| 6. Go-to-market | Munich universities → international student WhatsApp groups → word of mouth |
| 7. Team | Why we are the team that wins this — we lived it |

---

## Judging rubric alignment

| Criterion | How Klar scores |
|---|---|
| **Problem / customer** | Named buyer (international student), named moment (Ausländerbehörde letter + German form), named consequence (legal status at risk) |
| **Market / business** | Service replacement (€150 lawyer → €8/month), not another wrapper. Three features no competitor has. |
| **Product execution + AI leverage** | Working demo: OCR + agent + RAG + response generation + form-fill + chat in 27s. Multi-model pipeline, not a wrapper. Qwen sponsor maximized. |
| **Evidence / founder edge** | "We lived it" + real user validation |
| **Pitch clarity** | Specific in first 15 seconds, founder-market fit in first 30, three demo-able features that judges can see working |
