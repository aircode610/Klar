import { http, HttpResponse, delay } from "msw";
import type { ActionItem, ActionStatus, Letter } from "@/types";
import { freshUploadLetter, ragHits, seedLetters } from "./fixtures";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

// --- Mutable in-memory state ---------------------------------------------

let letters: Letter[] = seedLetters();
let counter = 500;

function findLetter(id: string) {
  return letters.find((l) => l.id === id);
}
function findAction(id: string): { letter: Letter; action: ActionItem } | null {
  for (const letter of letters) {
    const action = letter.actions.find((a) => a.id === id);
    if (action) return { letter, action };
  }
  return null;
}

export const handlers = [
  http.get(`${BASE}/health`, () =>
    HttpResponse.json({ status: "ok", service: "klar", model: "qwen3.7-plus (mock)" }),
  ),

  // --- Letters -----------------------------------------------------------
  http.post(`${BASE}/letters`, async ({ request }) => {
    await request.formData(); // consume multipart `file`
    await delay(2600); // simulate vision extraction
    const letter = freshUploadLetter(`ltr_upload_${counter++}`);
    letters = [letter, ...letters];
    return HttpResponse.json(letter);
  }),

  http.get(`${BASE}/letters/:id`, ({ params }) => {
    const letter = findLetter(params.id as string);
    if (!letter) return HttpResponse.json({ detail: "Letter not found" }, { status: 404 });
    return HttpResponse.json(letter);
  }),

  // --- Actions -----------------------------------------------------------
  http.get(`${BASE}/actions`, ({ request }) => {
    const status = new URL(request.url).searchParams.get("status") as ActionStatus | null;
    const rows = letters.flatMap((l) =>
      l.actions
        .filter((a) => !status || a.status === status)
        .map((a) => ({
          id: a.id,
          letter_id: l.id,
          title: a.title,
          deadline: a.deadline,
          severity: a.severity,
          status: a.status ?? "open",
          reply_needed: a.reply_needed ?? false,
        })),
    );
    return HttpResponse.json(rows);
  }),

  http.patch(`${BASE}/actions/:id`, async ({ params, request }) => {
    const found = findAction(params.id as string);
    if (!found) return HttpResponse.json({ detail: "Action not found" }, { status: 404 });
    const body = (await request.json()) as Partial<ActionItem>;
    Object.assign(found.action, body);
    return HttpResponse.json({
      id: found.action.id,
      status: found.action.status ?? "open",
    });
  }),

  // --- RAG ---------------------------------------------------------------
  http.post(`${BASE}/rag/search`, async ({ request }) => {
    const body = (await request.json()) as { query: string; institution?: string };
    await delay(400);
    return HttpResponse.json({ hits: ragHits(body.query, body.institution) });
  }),
];
