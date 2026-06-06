import { http, HttpResponse, delay } from "msw";
import type {
  CheckoutTarget,
  Deadline,
  DeadlineEntry,
  Letter,
  Me,
  PaymentStatus,
  Urgency,
} from "@/types";
import {
  SAMPLE_OUTPUTS,
  mockConfig,
  mockMe,
  seedLetters,
} from "./fixtures";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
const V1 = `${BASE}/v1`;

// --- Mutable in-memory session state -------------------------------------

let letters: Letter[] = seedLetters();
let me: Me = structuredClone(mockMe);
let idCounter = 100;

/** Tracks documents still "processing" and when they should flip to ready. */
const processingUntil = new Map<string, number>();

/** Payment records created by checkout, flipped to paid on first poll. */
const payments = new Map<
  string,
  { status: PaymentStatus; target: CheckoutTarget }
>();

const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 0,
  urgent: 1,
  soon: 2,
  normal: 3,
  info: 4,
};

function findLetter(id: string): Letter | undefined {
  return letters.find((l) => l.id === id);
}

function jsonError(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

/** Promote a freshly-uploaded letter to `ready` with a template analysis. */
function buildReadyAnalysis(letter: Letter): Letter {
  const now = Date.now();
  const day = 86_400_000;
  return {
    ...letter,
    status: "ready",
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
      date: new Date(now + 14 * day).toISOString(),
      label: "Object by 20 June",
      urgency: "soon",
      daysRemaining: 14,
    },
    recommendedActions: [
      { id: "a1", text: "File a written objection", primary: true },
    ],
    output: {
      type: "reply_letter",
      locked: !me.subscription.active,
      available: false,
      previewText:
        "Betreff: Einspruch gegen den Einkommensteuerbescheid 2024\n\nSehr geehrte Damen und Herren …",
      bodyText: null,
      downloadUrl: null,
      price: mockConfig.perLetterPrice,
    },
    originalText:
      "Finanzamt Hamburg-Mitte\nBescheid für 2024 über Einkommensteuer\nFestgesetzt werden: 412,00 EUR.",
    confidence: 0.94,
  };
}

export const handlers = [
  // --- Session & config --------------------------------------------------
  http.post(`${V1}/session`, () => {
    return HttpResponse.json({ sessionToken: "mock-session-token", me });
  }),

  http.get(`${V1}/config`, () => HttpResponse.json(mockConfig)),

  http.get(`${V1}/me`, () => HttpResponse.json(me)),

  http.patch(`${V1}/me`, async ({ request }) => {
    const body = (await request.json()) as { language?: Me["language"] };
    if (body.language) me = { ...me, language: body.language };
    return HttpResponse.json(me);
  }),

  // --- Documents ---------------------------------------------------------
  http.get(`${V1}/documents`, () => {
    return HttpResponse.json({ items: letters, nextCursor: null });
  }),

  http.post(`${V1}/documents`, async ({ request }) => {
    await request.formData(); // consume the multipart body (field: file)
    const id = `ltr_upload_${idCounter++}`;
    const letter: Letter = {
      id,
      status: "processing",
      createdAt: new Date().toISOString(),
      thumbnailUrl: null,
      handled: false,
      sender: null,
      documentType: null,
      referenceNumber: null,
      summary: null,
      whatItWants: null,
      consequence: null,
      deadline: null,
      recommendedActions: [],
      output: {
        type: "none",
        locked: true,
        available: false,
        previewText: null,
        bodyText: null,
        downloadUrl: null,
        price: null,
      },
      originalText: null,
      confidence: null,
    };
    letters = [letter, ...letters];
    processingUntil.set(id, Date.now() + 3500); // ready after ~3.5s of polling
    return HttpResponse.json(letter, { status: 201 });
  }),

  http.get(`${V1}/documents/:id`, ({ params }) => {
    const id = params.id as string;
    let letter = findLetter(id);
    if (!letter) return jsonError(404, "NOT_FOUND", "That letter does not exist.");

    const readyAt = processingUntil.get(id);
    if (letter.status === "processing" && readyAt && Date.now() >= readyAt) {
      const ready = buildReadyAnalysis(letter);
      letters = letters.map((l) => (l.id === id ? ready : l));
      processingUntil.delete(id);
      letter = ready;
    }
    return HttpResponse.json(letter);
  }),

  http.delete(`${V1}/documents/:id`, ({ params }) => {
    const id = params.id as string;
    letters = letters.filter((l) => l.id !== id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${V1}/documents/:id/output`, ({ params }) => {
    const id = params.id as string;
    const letter = findLetter(id);
    if (!letter) return jsonError(404, "NOT_FOUND", "That letter does not exist.");

    const unlocked = !letter.output.locked || me.subscription.active;
    const sample = SAMPLE_OUTPUTS[id];
    const next: Letter = {
      ...letter,
      output: {
        ...letter.output,
        available: true,
        locked: !unlocked,
        bodyText: unlocked && sample ? sample.bodyText : null,
        downloadUrl: unlocked && sample ? sample.downloadUrl : null,
      },
    };
    letters = letters.map((l) => (l.id === id ? next : l));
    return HttpResponse.json(next);
  }),

  http.patch(`${V1}/documents/:id`, async ({ params, request }) => {
    const id = params.id as string;
    const letter = findLetter(id);
    if (!letter) return jsonError(404, "NOT_FOUND", "That letter does not exist.");
    const body = (await request.json()) as { handled?: boolean };
    const next = { ...letter, handled: body.handled ?? letter.handled };
    letters = letters.map((l) => (l.id === id ? next : l));
    return HttpResponse.json(next);
  }),

  // --- Deadlines ---------------------------------------------------------
  http.get(`${V1}/deadlines`, () => {
    const items: DeadlineEntry[] = letters
      .filter((l) => l.deadline && l.deadline.date && !l.handled)
      .map((l) => ({
        letterId: l.id,
        sender: l.sender ?? "Unknown sender",
        deadline: l.deadline as Deadline,
      }))
      .sort(
        (a, b) =>
          URGENCY_RANK[a.deadline.urgency] - URGENCY_RANK[b.deadline.urgency],
      );
    return HttpResponse.json({ items });
  }),

  http.post(`${V1}/documents/:id/reminder`, async () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // --- Payments (Mollie, mocked) -----------------------------------------
  http.post(`${V1}/payments/checkout`, async ({ request }) => {
    const target = (await request.json()) as CheckoutTarget;
    const paymentId = `pay_mock_${idCounter++}`;
    payments.set(paymentId, { status: "open", target });
    // In the real flow this is Mollie's hosted page. The mock return route
    // simulates paying and bounces back to the app (wired in Phase 3).
    const checkoutUrl = `/pay/return?paymentId=${paymentId}`;
    return HttpResponse.json({ paymentId, checkoutUrl });
  }),

  http.get(`${V1}/payments/:id`, async ({ params }) => {
    const id = params.id as string;
    const record = payments.get(id);
    if (!record)
      return jsonError(404, "NOT_FOUND", "That payment does not exist.");

    // Simulate the webhook: first poll flips it to paid and applies the effect.
    if (record.status === "open") {
      record.status = "paid";
      if (record.target.target === "document") {
        const docId = record.target.documentId;
        const letter = findLetter(docId);
        if (letter) {
          letters = letters.map((l) =>
            l.id === docId
              ? { ...l, output: { ...l.output, locked: false } }
              : l,
          );
        }
      } else {
        me = {
          ...me,
          subscription: {
            active: true,
            planId: record.target.planId,
            renewsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          },
        };
      }
    }
    await delay(300);
    return HttpResponse.json({ status: record.status });
  }),
];
