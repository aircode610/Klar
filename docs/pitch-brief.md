# Klar — Pitch Brief & Market Research Input

> Feed this document to an AI for market analysis, competitive research, and pitch deck creation.

---

## One-sentence pitch

Klar reads your German official letter, tells you exactly what's required, and drafts the response you send back — in the agency's own language.

## The problem (specific buyer, specific pain)

**Who:** International students and skilled workers in Germany — 450,000+ new international students enroll each year, plus ~250,000 skilled worker visa holders.

**The moment of pain:** You receive an official German letter from the Ausländerbehörde, Krankenkasse, Finanzamt, or university. It's in legal German (Behördendeutsch) you can't fully read. It has a deadline. Missing it could cost your residence permit, your health insurance, or your tax refund. You don't know what it means, what to do, or how to respond.

**What they do today (the status quo we replace):**
- Pay a lawyer €150 for 20 minutes to explain one letter
- Panic-post on Reddit/Facebook expat groups and wait for unreliable advice
- Ask German friends/colleagues to translate (social debt, delays)
- Ignore it and hope for the best (worst case: deportation proceedings)

**Why this is painful enough to pay for:** A missed Ausländerbehörde deadline isn't annoying — it can cost your legal right to stay in Germany. Permit must be applied for within 90 days; appointment waits run 4-8 weeks. Real panic = real demand.

## What Klar does

Upload any official German letter (photo, PDF, or camera capture). Klar:
1. **Reads it** — Qwen-VL OCR extracts every word from the scan
2. **Classifies it** — ReAct agent (LangGraph + Tavily search) identifies the letter type, sender, and urgency
3. **Scores the risk** — 1-5 scale with specific consequences ("miss this and your permit application is rejected")
4. **Explains it** — plain-language explanation in your language (English, German, Turkish, Arabic, Persian, etc.)
5. **Cites the law** — RAG pipeline retrieves actual § paragraphs from German legal texts (AufenthG, AsylG, SGB V, EStG, etc.) — no hallucinated citations
6. **Drafts the response** — ready-to-send cover letter in Behördendeutsch with document checklist

**What competitors don't do:** Every competitor (Admina, Bureaucracy Buddy, DocuPilot, mika, Ridocu) stops at "here's what it means + a to-do list." None produce the artifact. Klar generates the actual reply.

## The strategic insight (empty quadrant)

Two axes define this space:
- **Breadth:** broad (any letter, any agency) vs. narrow (one painful domain)
- **Depth:** explains (tells you what to do) vs. acts (does the work for you)

Every existing app clusters in **broad + explain-only**. The open quadrant — **narrow + acts for you** — is empty. That's our wedge.

We start narrow (student/immigration bureaucracy) and deep (draft the response), then expand.

## Why now

1. **AI can finally parse Behördendeutsch reliably.** Vision-language models (Qwen-VL) read handwritten stamps, faded faxes, and dense legal German that OCR couldn't touch 2 years ago.
2. **Germany's digitalization has stalled.** Only 166 of the services under the 2017 Online Access Act were available nationwide as of Jan 2025. 16 states, 11,000+ local authorities can't coordinate. The government won't fix this soon — which is exactly why a workaround layer has room to exist.
3. **Structured legal text is now embeddable.** RAG over German law (Aufenthaltsgesetz, Asylgesetz, etc.) means we can ground every claim in actual § paragraphs — killing the hallucination fear that stops anyone trusting AI with visa matters.

## Competitive landscape

| Competitor | What they do | What they don't do |
|---|---|---|
| **Admina** | Translate, summarize, step-by-step plan, deadline tracking, chat | Draft the response, cite law, risk score |
| **Bureaucracy Buddy / Papierkram** | "Not just a translator, we tell you what to do" + scam detection | Draft the response, legal grounding |
| **DocuPilot** | "AI digital binder for expats," Ausländerbehörde/Finanzamt terms | Draft the response, consequence engine |
| **mika, Ridocu** | Upload-and-explain core | Same — explain only |
| **€150 lawyer** | Explains and can draft response | Costs €150/letter, 20 min, requires appointment |
| **Reddit/Facebook groups** | Free, fast | Unreliable, no legal grounding, no response draft |

**Our edge:** We're the only one that produces the artifact (the response letter) with legal § citations. We replace the €150 lawyer consult, not compete with free explain-only apps.

## What we built (hackathon demo)

Full working pipeline, built from scratch on June 6:

| Component | Tech | Time |
|---|---|---|
| OCR | Qwen-VL-OCR (dedicated OCR model) | ~5s |
| Classification + Risk | LangGraph ReAct agent + Tavily search + Qwen 3.7 | ~7s |
| Legal retrieval | ChromaDB RAG over 13 German laws, 1,488 § paragraphs | ~2s |
| Response generation | Qwen 3.7 with anti-hallucination prompt + structured output | ~13s |
| **Total** | **End-to-end letter processing** | **~27s** |

**AI leverage (not a wrapper):**
- Qwen-VL for document OCR (vision model, not generic text)
- LangGraph ReAct agent with tool calling (web search for current rules)
- RAG over 13 German legal texts with cosine similarity retrieval
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

**Business model:** Freemium. First letter free (demonstrate value). €7.99/month for unlimited letters + deadline tracking + response drafts. Replace the €150 lawyer consult with a €8/month subscription.

## Evidence / founder-market fit

- We are international students in Germany. We have lived this exact letter — the Ausländerbehörde document request that arrives in legal German you can't read, with a 14-day deadline you can't miss.
- We have personally paid lawyers to explain letters. We have personally panicked in Reddit threads.
- [Add: user validation quotes, waitlist numbers, or "when can I try it" messages from classmates]

## Team

| Role | Person | Edge |
|---|---|---|
| [Name] | [Role] | [What they bring — domain knowledge, technical skill, lived experience] |
| [Name] | [Role] | |
| [Name] | [Role] | |
| [Name] | [Role] | |

## Biggest risk (we name it ourselves)

**Legal liability.** We generate response letters that people send to government agencies. If the response is wrong, the consequence could be a missed deadline or rejected application. Our mitigation: every legal claim is RAG-grounded in actual § text, anti-hallucination rules prevent made-up citations, and we clearly label the output as AI-generated assistance (not legal advice). Long-term: partnership with a legal review service for high-stakes letters.

## What we'd test next (Monday)

1. Send the demo to 20 classmates with real letters they've received. Measure: do they trust it enough to send the response?
2. A/B test: Klar response vs. what they'd write themselves vs. what a lawyer wrote. Have a native German speaker rate quality.
3. Validate pricing: would you pay €7.99/month for this? (The Mom Test: watch behavior, not compliments)

## Pitch deck mapping (7 slides)

| Slide | Content from this doc |
|---|---|
| 1. Problem + customer | "The moment of pain" section — specific buyer, specific letter, specific consequence |
| 2. Solution + product | "What Klar does" — 6-step pipeline, live demo |
| 3. Why now | AI reads Behördendeutsch + Germany's stalled digitalization + RAG over law |
| 4. Market + competition | Bottom-up sizing + competitive table + empty quadrant insight |
| 5. Business model + evidence | Freemium pricing + founder-market fit + user validation |
| 6. Go-to-market | Munich universities → international student WhatsApp groups → word of mouth |
| 7. Team | Why we are the team that wins this — we lived it |

---

## Judging rubric alignment

| Criterion | How Klar scores |
|---|---|
| **Problem / customer** | Named buyer (international student), named moment (Ausländerbehörde letter), named consequence (legal status at risk) |
| **Market / business** | Service replacement (€150 lawyer → €8/month), not another wrapper |
| **Product execution + AI leverage** | Working demo: OCR + agent + RAG + response generation in 27s. Not a wrapper — multi-model pipeline with legal grounding |
| **Evidence / founder edge** | "We lived it" + real user validation |
| **Pitch clarity** | Specific in first 15 seconds, founder-market fit in first 30 |
